// src/models/tenant/EducatorDocument.model.js
const mongoose = require("mongoose");

const EducatorDocumentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // optional if you prefer dbName as tenant boundary
    },
    subOrgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubOrg",
      required: false,
    },
    educatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUser",
      required: true,
    },
    type: {
      type: String,
      enum: ["idProof", "degree", "experience", "certification", "other"],
      default: "other",
    },
    title: {
      type: String,
      trim: true,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    filePublicId: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUser",
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "educator_documents",
    timestamps: false,
  }
);

module.exports = EducatorDocumentSchema;
