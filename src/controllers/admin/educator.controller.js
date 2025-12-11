// src/controllers/admin/educator.controller.js
const mediaService = require("../../services/media.service");
const { Organization } = require("../../config/masterDB");

// Helpers
function getTenantModels(req) {
  const tenant = req.tenant;
  if (!tenant || !tenant.models) {
    throw new Error("Tenant models not available on request");
  }
  return tenant.models;
}

function getCurrentUser(req) {
  return {
    userId: req.user && req.user.userId,
    role: req.user && req.user.role,
    subOrgId: req.user && req.user.subOrgId,
    orgId: req.user && req.user.orgId,
  };
}

// expects multipart/form-data
//  - file: File (field name: "file")
//  - type, title, description
async function uploadVerificationDoc(req, res, next) {
  try {
    const { OrgUser } = getTenantModels(req);
    const currentUser = getCurrentUser(req);
    const educatorId = req.params.id;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Document file is required (field name: 'file' or 'doc')",
      });
    }

    const { type, title, description } = req.body;

    const educator = await OrgUser.findOne({
      _id: educatorId,
      role: "educator",
    });

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found in tenant DB",
      });
    }

    // same access checks as we already wrote...

    // upload to Cloudinary (unchanged)
    const uploaded = await mediaService.uploadEducatorDoc(
      req.file.buffer,
      /* orgSlug */ "vidhyapat", // or resolved from orgId like before
      educatorId
    );

    educator.verificationDocs = educator.verificationDocs || [];
    educator.verificationDocs.push({
      type: type || "OTHER",
      url: uploaded.url,
      publicId: uploaded.publicId,
      uploadedAt: new Date(),
    });

    // ⬅️ IMPORTANT: only force pending if previously null/unverified
    if (
      !educator.verificationStatus ||
      educator.verificationStatus === "unverified"
    ) {
      educator.verificationStatus = "pending";
    }

    await educator.save();

    return res.status(200).json({
      success: true,
      data: {
        url: uploaded.url,
        publicId: uploaded.publicId,
      },
    });
  } catch (err) {
    next(err);
  }
}


/**
 * 2) Simple verification status
 *    GET /api/admin/educators/:id/verification-status
 */
async function getVerificationStatusById(req, res, next) {
  try {
    const { OrgUser } = getTenantModels(req);
    const currentUser = getCurrentUser(req);
    const { id } = req.params;

    const educator = await OrgUser.findById(id).lean();
    if (!educator || educator.role !== "educator") {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    if (
      currentUser.role === "educator" &&
      String(currentUser.userId) !== String(id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Educators can only view their own verification",
      });
    }

    if (currentUser.role === "subOrgAdmin") {
      if (
        educator.subOrgId &&
        String(educator.subOrgId) !== String(currentUser.subOrgId)
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Educator not in your sub-organization",
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        educatorId: educator._id.toString(),
        name: educator.name,
        status: educator.verificationStatus || "unverified",
        documents: educator.verificationDocs || [],
        lastUpdated: educator.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 3) List educators for verification
 *    GET /api/admin/educators?status=&q=&page=&limit=
 */
async function listEducatorsForVerification(req, res, next) {
  try {
    const { OrgUser } = getTenantModels(req);
    const currentUser = getCurrentUser(req);

    const {
      status,
      q,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { role: "educator" };

    if (status) {
      filter.verificationStatus = status;
    }

    if (q) {
      const regex = new RegExp(q, "i");
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }

    if (currentUser.role === "subOrgAdmin" && currentUser.subOrgId) {
      filter.subOrgId = currentUser.subOrgId;
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      OrgUser.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      OrgUser.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        items: items.map((u) => ({
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          phone: u.phone,
          status: u.verificationStatus || "unverified",
          userStatus: u.status,
          docsCount: (u.verificationDocs || []).length,
          reviewedAt: u.verificationReviewedAt || null,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4) Get single educator verification detail.
 *    GET /api/admin/educators/:id
 */
// Get full educator profile + verification + documents
// GET /api/admin/educators/:id
async function getEducatorVerificationById(req, res, next) {
  try {
    const { OrgUser } = getTenantModels(req);
    const currentUser = getCurrentUser(req);
    const { id } = req.params;

    const educator = await OrgUser.findOne({
      _id: id,
      role: "educator",
    }).lean();

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    // 🔐 Access control
    if (currentUser.role === "subOrgAdmin") {
      if (
        educator.subOrgId &&
        String(educator.subOrgId) !== String(currentUser.subOrgId)
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: educator not in your sub-organization",
        });
      }
    }

    if (
      currentUser.role === "educator" &&
      String(currentUser.userId) !== String(id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Educators can only view their own verification",
      });
    }

    // Default empty profile so frontend inputs don't break
    const defaultProfile = {
      title: "",
      bio: "",
      highestQualification: "",
      yearsOfExperience: null,
      expertiseAreas: [],
      languages: [],
      linkedinUrl: "",
      portfolioUrl: "",
    };

    return res.status(200).json({
      success: true,
      data: {
        id: educator._id.toString(),
        name: educator.name,
        email: educator.email,
        phone: educator.phone,
        role: educator.role,
        subOrgId: educator.subOrgId || null,

        // ⬅️ verification block in a stable shape
        verificationStatus: educator.verificationStatus || "pending",
        verificationNotes:
          educator.verificationReviewReason ||
          educator.verificationNotes ||
          null,
        verifiedBy: educator.verifiedBy || educator.verificationReviewedBy || null,
        verifiedAt: educator.verifiedAt || educator.verificationReviewedAt || null,

        // ⬅️ educatorProfile for your form
        educatorProfile: educator.educatorProfile || defaultProfile,

        // ⬅️ docs for your docs UI
        documents: educator.verificationDocs || [],

        // active/inactive/blocked
        userStatus: educator.status,
      },
    });
  } catch (err) {
    next(err);
  }
}


/**
 * 5) Approve / Reject educator verification.
 *    PATCH /api/admin/educators/:id/verification
 *    Body: { status: "approved" | "rejected", reason?: string }
 */
// Approve / Reject educator verification.
// PATCH /api/admin/educators/:id/verify
// Body: { status: "approved" | "rejected", notes?: string }
async function updateEducatorVerificationStatus(req, res, next) {
  try {
    const { OrgUser } = getTenantModels(req);
    const adminUser = getCurrentUser(req);
    const { id } = req.params;
    const { status, notes } = req.body;

    const allowed = ["approved", "rejected"];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be 'approved' or 'rejected'",
      });
    }

    const educator = await OrgUser.findOne({
      _id: id,
      role: "educator",
    });

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    if (adminUser.role === "subOrgAdmin") {
      if (
        educator.subOrgId &&
        String(educator.subOrgId) !== String(adminUser.subOrgId)
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: educator not in your sub-organization",
        });
      }
    }

    educator.verificationStatus = status;
    educator.verificationReviewedAt = new Date();
    educator.verificationReviewedBy = adminUser.userId;
    educator.verificationReviewReason = notes || null;
    educator.verifiedBy = adminUser.userId;
    educator.verifiedAt = new Date();
    educator.updatedAt = new Date();

    await educator.save();

    return res.status(200).json({
      success: true,
      data: {
        id: educator._id.toString(),
        verificationStatus: educator.verificationStatus,
        verificationNotes: educator.verificationReviewReason,
        verifiedBy: educator.verifiedBy,
        verifiedAt: educator.verifiedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}


// Update educator profile details
// PATCH /api/admin/educators/:id/profile
async function updateEducatorProfile(req, res, next) {
  try {
    const { OrgUser } = getTenantModels(req);
    const currentUser = getCurrentUser(req);
    const { id } = req.params;
    const { educatorProfile } = req.body;

    if (!educatorProfile || typeof educatorProfile !== "object") {
      return res.status(400).json({
        success: false,
        message: "educatorProfile object is required",
      });
    }

    const educator = await OrgUser.findOne({
      _id: id,
      role: "educator",
    });

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    // SubOrgAdmin: only their sub-org educators
    if (currentUser.role === "subOrgAdmin") {
      if (
        educator.subOrgId &&
        String(educator.subOrgId) !== String(currentUser.subOrgId)
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: educator not in your sub-organization",
        });
      }
    }

    // Educator: only self
    if (
      currentUser.role === "educator" &&
      String(currentUser.userId) !== String(id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Educators can only edit their own profile",
      });
    }

    // Merge new profile fields
    educator.educatorProfile = {
      ...(educator.educatorProfile || {}),
      ...educatorProfile,
    };

    await educator.save();

    return res.status(200).json({
      success: true,
      data: {
        id: educator._id.toString(),
        educatorProfile: educator.educatorProfile,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Delete a document from educator.verificationDocs
// DELETE /api/admin/educators/:id/documents/:docId
async function deleteEducatorDocument(req, res, next) {
  try {
    const { OrgUser } = getTenantModels(req);
    const currentUser = getCurrentUser(req);
    const { id, docId } = req.params;

    const educator = await OrgUser.findOne({
      _id: id,
      role: "educator",
    });

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    // Access control: same rules as upload
    if (
      currentUser.role === "educator" &&
      String(currentUser.userId) !== String(id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Educators can only delete their own documents",
      });
    }

    if (currentUser.role === "subOrgAdmin") {
      if (
        educator.subOrgId &&
        String(educator.subOrgId) !== String(currentUser.subOrgId)
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: educator not in your sub-organization",
        });
      }
    }

    // Find subdocument by _id
    const doc = educator.verificationDocs.id(docId);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Delete from Cloudinary if we have publicId
    if (doc.publicId) {
      // ensure you have mediaService.deleteEducatorDoc implemented
      await mediaService.deleteEducatorDoc(doc.publicId);
    }

    doc.remove();
    await educator.save();

    return res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (err) {
    next(err);
  }
}




module.exports = {
  uploadVerificationDoc,
  getVerificationStatusById,
  listEducatorsForVerification,
  getEducatorVerificationById,
  updateEducatorVerificationStatus,
  updateEducatorProfile,
  deleteEducatorDocument,
};
