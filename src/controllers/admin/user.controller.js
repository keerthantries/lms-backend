const userService = require("../../services/admin/user.service");

async function listUsers(req, res, next) {
  try {
    const tenant = req.tenant;
    const { OrgUser } = tenant.models;
    const currentUser = {
      userId: req.user.userId,
      role: req.user.role,
      subOrgId: req.user.subOrgId,
    };

    const result = await userService.listUsers({
      OrgUser,
      currentUser,
      query: req.query,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const tenant = req.tenant;
    const { OrgUser } = tenant.models;
    const currentUser = {
      userId: req.user.userId,
      role: req.user.role,
      subOrgId: req.user.subOrgId,
    };

    const result = await userService.getUserById({
      OrgUser,
      currentUser,
      userId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const tenant = req.tenant;
    const { OrgUser } = tenant.models;
    const currentUser = {
      userId: req.user.userId,
      role: req.user.role,
      subOrgId: req.user.subOrgId,
    };

    const result = await userService.createUser({
      OrgUser,
      currentUser,
      data: req.body,
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const tenant = req.tenant;
    const { OrgUser } = tenant.models;
    const currentUser = {
      userId: req.user.userId,
      role: req.user.role,
      subOrgId: req.user.subOrgId,
    };

    const result = await userService.updateUser({
      OrgUser,
      currentUser,
      userId: req.params.id,
      data: req.body,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function changeStatus(req, res, next) {
  try {
    const tenant = req.tenant;
    const { OrgUser } = tenant.models;
    const currentUser = {
      userId: req.user.userId,
      role: req.user.role,
      subOrgId: req.user.subOrgId,
    };

    const { status } = req.body;

    const result = await userService.changeUserStatus({
      OrgUser,
      currentUser,
      userId: req.params.id,
      status,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const tenant = req.tenant;
    const { OrgUser } = tenant.models;
    const currentUser = {
      userId: req.user.userId,
      role: req.user.role,
      subOrgId: req.user.subOrgId,
    };

    const { newPassword } = req.body;

    const result = await userService.resetPassword({
      OrgUser,
      currentUser,
      userId: req.params.id,
      newPassword,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changeStatus,
  resetPassword,
};
