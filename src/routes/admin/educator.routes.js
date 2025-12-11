// src/routes/admin/educator.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/auth.middleware");
const tenantMiddleware = require("../../middleware/tenant.middleware");
const roleMiddleware = require("../../middleware/role.middleware");
const upload = require("../../middleware/upload.middleware");
const educatorController = require("../../controllers/admin/educator.controller");

// All routes here require auth + tenant
router.use(authMiddleware);
router.use(tenantMiddleware);
// Admin, SubOrgAdmin, Educator can access (controller will enforce finer rules)
router.use(roleMiddleware(["admin", "subOrgAdmin", "educator"]));

/**
 * (Optional) list educators for verification
 * GET /api/admin/educators?status=&q=&page=&limit=
 */
router.get("/", educatorController.listEducatorsForVerification);

/**
 * Fetch full educator profile + verification + documents
 * GET /api/admin/educators/:id
 */
router.get("/:id", educatorController.getEducatorVerificationById);

/**
 * Simple status view (if needed)
 * GET /api/admin/educators/:id/verification-status
 */
router.get(
  "/:id/verification-status",
  educatorController.getVerificationStatusById
);

/**
 * Update educatorProfile section
 * PATCH /api/admin/educators/:id/profile
 */
router.patch("/:id/profile", educatorController.updateEducatorProfile);

/**
 * Upload a document (Multer + Cloudinary)
 * POST /api/admin/educators/:id/documents
 * form-data: doc (file), type, title, description
 */
router.post(
  "/:id/documents",
  upload.single("file"),
  educatorController.uploadVerificationDoc
);

/**
 * Delete a document
 * DELETE /api/admin/educators/:id/documents/:docId
 */
router.delete(
  "/:id/documents/:docId",
  educatorController.deleteEducatorDocument
);

/**
 * Approve / reject educator
 * PATCH /api/admin/educators/:id/verify
 */
router.patch("/:id/verify", educatorController.updateEducatorVerificationStatus);

module.exports = router;
