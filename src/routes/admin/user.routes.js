// src/routes/admin/user.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/auth.middleware");
const tenantMiddleware = require("../../middleware/tenant.middleware");
const roleMiddleware = require("../../middleware/role.middleware");
const userController = require("../../controllers/admin/user.controller");

// All user-management routes require logged-in admin or subOrgAdmin
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(roleMiddleware(["admin", "subOrgAdmin"]));

// GET /api/admin/users
router.get("/", userController.listUsers);

// GET /api/admin/users/:id
router.get("/:id", userController.getUser);

// POST /api/admin/users
router.post("/", userController.createUser);

// PATCH /api/admin/users/:id
router.patch("/:id", userController.updateUser);

// PATCH /api/admin/users/:id/status
router.patch("/:id/status", userController.changeStatus);

// POST /api/admin/users/:id/resetPassword
router.post("/:id/resetPassword", userController.resetPassword);

module.exports = router;
