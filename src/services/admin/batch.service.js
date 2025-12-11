// src/services/admin/batch.service.js

async function listBatches({ Batch, currentUser, query }) {
  const {
    status,
    q,
    educatorId,
    subOrgId,
    courseId,
    page = 1,
    limit = 20,
  } = query;

  const filter = {};

  if (status) filter.status = status;
  if (educatorId) filter.educatorId = educatorId;
  if (courseId) filter.courseId = courseId;

  if (currentUser.role === "subOrgAdmin" && currentUser.subOrgId) {
    filter.subOrgId = currentUser.subOrgId;
  }

  if (subOrgId) filter.subOrgId = subOrgId;

  if (q) {
    const regex = new RegExp(q, "i");
    filter.$or = [{ name: regex }, { code: regex }];
  }

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Batch.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Batch.countDocuments(filter),
  ]);

  return {
    items: items.map((b) => ({
      id: b._id.toString(),
      name: b.name,
      code: b.code,
      courseId: b.courseId,
      educatorId: b.educatorId,
      subOrgId: b.subOrgId || null,
      mode: b.mode,
      startDate: b.startDate,
      endDate: b.endDate,
      capacity: b.capacity,
      enrollmentCount: b.enrollmentCount,
      status: b.status,
      createdAt: b.createdAt,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

async function getBatchById({ Batch, currentUser, batchId }) {
  const b = await Batch.findById(batchId).lean();
  if (!b) {
    const err = new Error("Batch not found");
    err.statusCode = 404;
    throw err;
  }

  if (
    currentUser.role === "subOrgAdmin" &&
    currentUser.subOrgId &&
    b.subOrgId &&
    String(b.subOrgId) !== String(currentUser.subOrgId)
  ) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  if (
    currentUser.role === "educator" &&
    String(b.educatorId) !== String(currentUser.userId)
  ) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  return {
    id: b._id.toString(),
    name: b.name,
    code: b.code,
    courseId: b.courseId,
    educatorId: b.educatorId,
    subOrgId: b.subOrgId || null,
    mode: b.mode,
    startDate: b.startDate,
    endDate: b.endDate,
    capacity: b.capacity,
    enrollmentCount: b.enrollmentCount,
    status: b.status,
    schedule: b.schedule || {},
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

/**
 * Create a batch with educator + mode
 */
async function createBatch({ Batch, OrgUser, currentUser, data }) {
  const {
    name,
    code,
    courseId,
    educatorId,
    subOrgId,
    startDate,
    endDate,
    capacity,
    schedule,
    mode,
  } = data;

  if (!name || !courseId || !educatorId) {
    const err = new Error("name, courseId, and educatorId are required");
    err.statusCode = 400;
    throw err;
  }

  if (!["admin", "subOrgAdmin", "educator"].includes(currentUser.role)) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  // validate educator & verification
  const educator = await OrgUser.findOne({
    _id: educatorId,
    role: "educator",
  }).lean();

  if (!educator) {
    const err = new Error("Educator not found");
    err.statusCode = 404;
    throw err;
  }

  if (educator.verificationStatus !== "approved") {
    const err = new Error(
      "Educator is not verified. Only verified educators can be assigned to a batch."
    );
    err.statusCode = 400;
    throw err;
  }

  // Determine final subOrgId
  let finalSubOrgId = subOrgId || educator.subOrgId || null;

  if (currentUser.role === "subOrgAdmin") {
    if (!currentUser.subOrgId) {
      const err = new Error(
        "SubOrgAdmin must belong to a sub-organization to create batches"
      );
      err.statusCode = 400;
      throw err;
    }
    if (
      educator.subOrgId &&
      String(educator.subOrgId) !== String(currentUser.subOrgId)
    ) {
      const err = new Error(
        "Educator does not belong to your sub-organization"
      );
      err.statusCode = 403;
      throw err;
    }
    finalSubOrgId = currentUser.subOrgId;
  }

  if (currentUser.role === "educator") {
    if (String(educatorId) !== String(currentUser.userId)) {
      const err = new Error(
        "Educators can only create batches for themselves"
      );
      err.statusCode = 403;
      throw err;
    }
    finalSubOrgId = educator.subOrgId || null;
  }

  const now = new Date();
  const batch = await Batch.create({
    name,
    code: code || null,
    courseId,
    educatorId,
    subOrgId: finalSubOrgId,
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    capacity: capacity || 0,
    enrollmentCount: 0,
    mode: mode || "online",
    status: "draft",
    schedule: schedule || {},
    createdBy: currentUser.userId || null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: batch._id.toString(),
    name: batch.name,
    code: batch.code,
    courseId: batch.courseId,
    educatorId: batch.educatorId,
    subOrgId: batch.subOrgId || null,
    mode: batch.mode,
    startDate: batch.startDate,
    endDate: batch.endDate,
    capacity: batch.capacity,
    enrollmentCount: batch.enrollmentCount,
    status: batch.status,
  };
}

/**
 * Update batch details (change educator, mode, etc.)
 */
async function updateBatch({ Batch, OrgUser, currentUser, batchId, data }) {
  const batch = await Batch.findById(batchId);
  if (!batch) {
    const err = new Error("Batch not found");
    err.statusCode = 404;
    throw err;
  }

  if (
    currentUser.role === "subOrgAdmin" &&
    currentUser.subOrgId &&
    batch.subOrgId &&
    String(batch.subOrgId) !== String(currentUser.subOrgId)
  ) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  if (
    currentUser.role === "educator" &&
    String(batch.educatorId) !== String(currentUser.userId)
  ) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  const updatableFields = [
    "name",
    "code",
    "startDate",
    "endDate",
    "capacity",
    "status",
    "schedule",
    "mode",
  ];

  updatableFields.forEach((field) => {
    if (data[field] !== undefined) {
      if (field === "startDate" || field === "endDate") {
        batch[field] = data[field] ? new Date(data[field]) : null;
      } else {
        batch[field] = data[field];
      }
    }
  });

  // Change educator (admin only)
  if (data.educatorId && currentUser.role === "admin") {
    const educator = await OrgUser.findOne({
      _id: data.educatorId,
      role: "educator",
    }).lean();

    if (!educator) {
      const err = new Error("New educator not found");
      err.statusCode = 404;
      throw err;
    }

    if (educator.verificationStatus !== "approved") {
      const err = new Error("New educator is not verified");
      err.statusCode = 400;
      throw err;
    }

    batch.educatorId = data.educatorId;
    if (educator.subOrgId) {
      batch.subOrgId = educator.subOrgId;
    }
  }

  batch.updatedAt = new Date();
  await batch.save();

  return {
    id: batch._id.toString(),
    name: batch.name,
    code: batch.code,
    courseId: batch.courseId,
    educatorId: batch.educatorId,
    subOrgId: batch.subOrgId || null,
    mode: batch.mode,
    startDate: batch.startDate,
    endDate: batch.endDate,
    capacity: batch.capacity,
    enrollmentCount: batch.enrollmentCount,
    status: batch.status,
    schedule: batch.schedule || {},
  };
}

async function changeBatchStatus({ Batch, currentUser, batchId, status }) {
  const allowed = ["draft", "published", "ongoing", "completed", "cancelled"];
  if (!allowed.includes(status)) {
    const err = new Error("Invalid batch status");
    err.statusCode = 400;
    throw err;
  }

  const batch = await Batch.findById(batchId);
  if (!batch) {
    const err = new Error("Batch not found");
    err.statusCode = 404;
    throw err;
  }

  if (
    currentUser.role === "subOrgAdmin" &&
    currentUser.subOrgId &&
    batch.subOrgId &&
    String(batch.subOrgId) !== String(currentUser.subOrgId)
  ) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  if (
    currentUser.role === "educator" &&
    String(batch.educatorId) !== String(currentUser.userId)
  ) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  batch.status = status;
  batch.updatedAt = new Date();
  await batch.save();

  return {
    id: batch._id.toString(),
    status: batch.status,
  };
}

/**
 * List enrollments in a batch
 */
async function listBatchEnrollments({ Enrollment, currentUser, batchId, query }) {
  const { page = 1, limit = 20 } = query;

  const filter = { batchId };

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Enrollment.find(filter)
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Enrollment.countDocuments(filter),
  ]);

  return {
    items: items.map((e) => ({
      id: e._id.toString(),
      learnerId: e.learnerId,
      subOrgId: e.subOrgId || null,
      status: e.status,
      source: e.source,
      startDate: e.startDate || null,
      expiryDate: e.expiryDate || null,
      notes: e.notes || null,
      enrolledBy: e.enrolledBy || null,
      enrolledAt: e.enrolledAt,
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
 * Single enroll (admin/subOrgAdmin/educator)
 */
async function enrollLearner({
  Batch,
  Enrollment,
  OrgUser,
  currentUser,
  batchId,
  learnerId,
  startDate,
  expiryDate,
  notes,
}) {
  const batch = await Batch.findById(batchId);
  if (!batch) {
    const err = new Error("Batch not found");
    err.statusCode = 404;
    throw err;
  }

  // capacity
  if (batch.capacity && batch.enrollmentCount >= batch.capacity) {
    const err = new Error("Batch is full");
    err.statusCode = 400;
    throw err;
  }

  if (!["published", "ongoing"].includes(batch.status)) {
    const err = new Error(
      "Enrollments are allowed only for published/ongoing batches"
    );
    err.statusCode = 400;
    throw err;
  }

  if (!["admin", "subOrgAdmin", "educator"].includes(currentUser.role)) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  const learner = await OrgUser.findOne({
    _id: learnerId,
    role: "learner",
  }).lean();

  if (!learner) {
    const err = new Error("Learner not found");
    err.statusCode = 404;
    throw err;
  }

  const existing = await Enrollment.findOne({
    batchId,
    learnerId,
    status: { $in: ["pending", "confirmed"] },
  }).lean();

  if (existing) {
    const err = new Error("Learner is already enrolled in this batch");
    err.statusCode = 400;
    throw err;
  }

  const enrollment = await Enrollment.create({
    batchId,
    learnerId,
    subOrgId: batch.subOrgId || learner.subOrgId || null,
    status: "confirmed",
    source: "admin",
    startDate: startDate ? new Date(startDate) : null,
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    notes: notes || null,
    enrolledBy: currentUser.userId || null,
    enrolledAt: new Date(),
  });

  batch.enrollmentCount = (batch.enrollmentCount || 0) + 1;
  await batch.save();

  return {
    id: enrollment._id.toString(),
    batchId: enrollment.batchId,
    learnerId: enrollment.learnerId,
    status: enrollment.status,
    source: enrollment.source,
    startDate: enrollment.startDate,
    expiryDate: enrollment.expiryDate,
    notes: enrollment.notes,
    enrolledBy: enrollment.enrolledBy,
    enrolledAt: enrollment.enrolledAt,
  };
}

/**
 * Learner self-enrollment into a batch
 */
async function selfEnrollInBatch({
  Batch,
  Enrollment,
  OrgUser,
  currentUser,
  batchId,
  startDate,
  expiryDate,
  notes,
}) {
  // Only learners can self-enroll
  if (currentUser.role !== "learner") {
    const err = new Error("Forbidden: only learners can self-enroll");
    err.statusCode = 403;
    throw err;
  }

  const learnerId = currentUser.userId;

  const batch = await Batch.findById(batchId);
  if (!batch) {
    const err = new Error("Batch not found");
    err.statusCode = 404;
    throw err;
  }

  // Only published/ongoing batches
  if (!["published", "ongoing"].includes(batch.status)) {
    const err = new Error(
      "Enrollments are allowed only for published/ongoing batches"
    );
    err.statusCode = 400;
    throw err;
  }

  // Capacity check
  if (batch.capacity && batch.enrollmentCount >= batch.capacity) {
    const err = new Error("Batch is full");
    err.statusCode = 400;
    throw err;
  }

  // Make sure learner exists
  const learner = await OrgUser.findOne({
    _id: learnerId,
    role: "learner",
  }).lean();

  if (!learner) {
    const err = new Error("Learner not found");
    err.statusCode = 404;
    throw err;
  }

  // Prevent duplicate enrollment
  const existing = await Enrollment.findOne({
    batchId,
    learnerId,
    status: { $in: ["pending", "confirmed"] },
  }).lean();

  if (existing) {
    const err = new Error("You are already enrolled in this batch");
    err.statusCode = 400;
    throw err;
  }

  const enrollment = await Enrollment.create({
    batchId,
    learnerId,
    subOrgId: batch.subOrgId || learner.subOrgId || null,
    status: "confirmed",
    source: "self", // 👈 important for analytics
    startDate: startDate ? new Date(startDate) : null,
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    notes: notes || null,
    enrolledBy: learnerId,
    enrolledAt: new Date(),
  });

  batch.enrollmentCount = (batch.enrollmentCount || 0) + 1;
  await batch.save();

  return {
    id: enrollment._id.toString(),
    batchId: enrollment.batchId,
    learnerId: enrollment.learnerId,
    status: enrollment.status,
    source: enrollment.source,
    startDate: enrollment.startDate,
    expiryDate: enrollment.expiryDate,
    notes: enrollment.notes,
    enrolledBy: enrollment.enrolledBy,
    enrolledAt: enrollment.enrolledAt,
  };
}


/**
 * Bulk enroll (admin/subOrgAdmin/educator) – learnerIds[]
 */
async function bulkEnrollLearners({
  Batch,
  Enrollment,
  OrgUser,
  currentUser,
  batchId,
  learnerIds,
  startDate,
  expiryDate,
  notes,
}) {
  if (!Array.isArray(learnerIds) || learnerIds.length === 0) {
    const err = new Error("learnerIds must be a non-empty array");
    err.statusCode = 400;
    throw err;
  }

  const batch = await Batch.findById(batchId);
  if (!batch) {
    const err = new Error("Batch not found");
    err.statusCode = 404;
    throw err;
  }

  if (!["admin", "subOrgAdmin", "educator"].includes(currentUser.role)) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  if (!["published", "ongoing"].includes(batch.status)) {
    const err = new Error(
      "Enrollments are allowed only for published/ongoing batches"
    );
    err.statusCode = 400;
    throw err;
  }

  let currentCount = batch.enrollmentCount || 0;
  const capacity = batch.capacity || 0;
  const results = [];

  for (const learnerId of learnerIds) {
    const item = {
      learnerId,
      status: "error",
      enrollmentId: null,
      message: null,
    };

    try {
      if (capacity && currentCount >= capacity) {
        item.message = "Batch is full";
        results.push(item);
        continue;
      }

      const learner = await OrgUser.findOne({
        _id: learnerId,
        role: "learner",
      }).lean();

      if (!learner) {
        item.message = "Learner not found";
        results.push(item);
        continue;
      }

      const existing = await Enrollment.findOne({
        batchId,
        learnerId,
        status: { $in: ["pending", "confirmed"] },
      }).lean();

      if (existing) {
        item.message = "Learner is already enrolled in this batch";
        results.push(item);
        continue;
      }

      const enrollment = await Enrollment.create({
        batchId,
        learnerId,
        subOrgId: batch.subOrgId || learner.subOrgId || null,
        status: "confirmed",
        source: "admin",
        startDate: startDate ? new Date(startDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes: notes || null,
        enrolledBy: currentUser.userId || null,
        enrolledAt: new Date(),
      });

      currentCount += 1;

      item.status = "success";
      item.enrollmentId = enrollment._id.toString();
      item.message = null;
      results.push(item);
    } catch (e) {
      item.message = e.message || "Unknown error";
      results.push(item);
    }
  }

  batch.enrollmentCount = currentCount;
  await batch.save();

  const successCount = results.filter((r) => r.status === "success").length;
  const failureCount = results.length - successCount;

  return {
    batchId: batch._id.toString(),
    total: results.length,
    successCount,
    failureCount,
    results,
  };
}

module.exports = {
  listBatches,
  getBatchById,
  createBatch,
  updateBatch,
  changeBatchStatus,
  listBatchEnrollments,
  enrollLearner,
  bulkEnrollLearners,
  selfEnrollInBatch,
};
