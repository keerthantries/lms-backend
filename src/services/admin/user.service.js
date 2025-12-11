const bcrypt = require("bcryptjs");

/**
 * List users with filters (role, status, search, pagination)
 */
async function listUsers({ OrgUser, currentUser, query }) {
  const {
    role,
    status,
    q,          // search term
    page = 1,
    limit = 20,
  } = query;

  const filter = {};

  if (role) {
    filter.role = role;
  }

  if (status) {
    filter.status = status;
  }

  // SubOrgAdmin can only see users in their subOrg
  if (currentUser.role === "subOrgAdmin" && currentUser.subOrgId) {
    filter.subOrgId = currentUser.subOrgId;
  }

  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { email: new RegExp(q, "i") },
      { phone: new RegExp(q, "i") },
    ];
  }

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    OrgUser.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    OrgUser.countDocuments(filter),
  ]);

  return {
    items: items.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      subOrgId: u.subOrgId || null,
      lastLoginAt: u.lastLoginAt || null,
      createdAt: u.createdAt,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

/**
 * Get single user by ID with access control.
 */
async function getUserById({ OrgUser, currentUser, userId }) {
  const user = await OrgUser.findById(userId).lean();

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // SubOrgAdmin cannot see users outside their subOrg
  if (
    currentUser.role === "subOrgAdmin" &&
    currentUser.subOrgId &&
    user.subOrgId &&
    String(user.subOrgId) !== String(currentUser.subOrgId)
  ) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    subOrgId: user.subOrgId || null,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
  };
}

/**
 * Create a new user (Admin / SubOrgAdmin)
 */
async function createUser({ OrgUser, currentUser, data }) {
  const {
    name,
    email,
    phone,
    role,
    subOrgId,
    password, // optional: if not given, we can auto-generate
  } = data;

  if (!name || !role) {
    const err = new Error("name and role are required");
    err.statusCode = 400;
    throw err;
  }

  // Role access rules
  if (currentUser.role === "subOrgAdmin") {
    // SubOrgAdmin cannot create tenant admins
    if (role === "admin" || role === "subOrgAdmin") {
      const err = new Error("SubOrg admin cannot create admin roles");
      err.statusCode = 403;
      throw err;
    }
  }

  // Email/phone uniqueness per tenant (simple check)
  if (email) {
    const existing = await OrgUser.findOne({ email }).lean();
    if (existing) {
      const err = new Error("Email already in use");
      err.statusCode = 409;
      throw err;
    }
  }

  let passwordHash = null;

  if (password) {
    passwordHash = await bcrypt.hash(password, 10);
  }

  const now = new Date();

  const userDoc = await OrgUser.create({
    name,
    email: email || null,
    phone: phone || null,
    role,
    status: "active",
    subOrgId:
      currentUser.role === "subOrgAdmin"
        ? currentUser.subOrgId || null
        : subOrgId || null,
    passwordHash,
    createdBy: currentUser.userId || null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: userDoc._id.toString(),
    name: userDoc.name,
    email: userDoc.email,
    phone: userDoc.phone,
    role: userDoc.role,
    status: userDoc.status,
    subOrgId: userDoc.subOrgId || null,
  };
}

/**
 * Update user basic details (name, phone, role, subOrg)
 * (not password here)
 */
async function updateUser({ OrgUser, currentUser, userId, data }) {
  const user = await OrgUser.findById(userId);

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // SubOrgAdmin cannot modify users outside their subOrg
  if (
    currentUser.role === "subOrgAdmin" &&
    currentUser.subOrgId &&
    user.subOrgId &&
    String(user.subOrgId) !== String(currentUser.subOrgId)
  ) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  // SubOrgAdmin cannot upgrade role to admin/subOrgAdmin
  if (currentUser.role === "subOrgAdmin" && data.role) {
    if (["admin", "subOrgAdmin"].includes(data.role)) {
      const err = new Error("SubOrg admin cannot assign admin roles");
      err.statusCode = 403;
      throw err;
    }
  }

  if (data.name !== undefined) user.name = data.name;
  if (data.phone !== undefined) user.phone = data.phone;
  if (data.role !== undefined) user.role = data.role;

  if (currentUser.role === "admin" && data.subOrgId !== undefined) {
    user.subOrgId = data.subOrgId || null;
  }

  user.updatedAt = new Date();
  await user.save();

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    subOrgId: user.subOrgId || null,
  };
}

/**
 * Change user status (active/inactive/blocked)
 */
async function changeUserStatus({ OrgUser, currentUser, userId, status }) {
  const allowedStatuses = ["active", "inactive", "blocked"];

  if (!allowedStatuses.includes(status)) {
    const err = new Error("Invalid status");
    err.statusCode = 400;
    throw err;
  }

  const user = await OrgUser.findById(userId);

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  if (
    currentUser.role === "subOrgAdmin" &&
    currentUser.subOrgId &&
    user.subOrgId &&
    String(user.subOrgId) !== String(currentUser.subOrgId)
  ) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  user.status = status;
  user.updatedAt = new Date();
  await user.save();

  return {
    id: user._id.toString(),
    status: user.status,
  };
}
/**
 * Reset user password
 */
async function resetPassword({ OrgUser, currentUser, userId, newPassword }) {
  if (!newPassword) {
    const err = new Error("newPassword is required");
    err.statusCode = 400;
    throw err;
  }

  const user = await OrgUser.findById(userId);

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // Same visibility rule as changeUserStatus:
  // SubOrgAdmin cannot modify users outside their subOrg
  if (
    currentUser.role === "subOrgAdmin" &&
    currentUser.subOrgId &&
    user.subOrgId &&
    String(user.subOrgId) !== String(currentUser.subOrgId)
  ) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  // (Optional hardening: prevent subOrgAdmin from resetting admin passwords)
  // if (currentUser.role === "subOrgAdmin" && ["admin", "subOrgAdmin"].includes(user.role)) {
  //   const err = new Error("SubOrg admin cannot reset admin passwords");
  //   err.statusCode = 403;
  //   throw err;
  // }

  const hash = await bcrypt.hash(newPassword, 10);

  // You are already using `passwordHash` in createUser, so we keep same field
  user.passwordHash = hash;
  user.updatedAt = new Date();
  await user.save();

  return {
    id: user._id.toString(),
    message: "Password reset successfully",
  };
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  changeUserStatus,
  resetPassword,
};
