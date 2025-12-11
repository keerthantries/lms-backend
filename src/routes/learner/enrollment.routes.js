// src/routes/learner/enrollment.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/auth.middleware");
const tenantMiddleware = require("../../middleware/tenant.middleware");
const roleMiddleware = require("../../middleware/role.middleware");
const batchController = require("../../controllers/admin/batch.controller");

// Learner-only routes, still reuse batchController.selfEnroll
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(roleMiddleware(["learner"]));

// Self enroll into a batch
// POST /api/learner/batches/:id/enroll
router.post("/batches/:id/enroll", batchController.selfEnroll);

module.exports = router;
