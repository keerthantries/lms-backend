// src/models/tenant/SubOrg.model.js
const mongoose = require("mongoose");

const SubOrgSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, trim: true }, // optional short code like "CSE-2025"

    description: { type: String },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // tenant-level org implied by DB; this is sub-org inside that tenant
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "OrgUser" },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "sub_orgs",
  }
);

module.exports = SubOrgSchema;
