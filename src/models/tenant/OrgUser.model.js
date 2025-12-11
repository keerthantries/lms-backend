const mongoose = require("mongoose");

const OrgUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: { type: String, trim: true, lowercase: true },
    phone: { type: String },

    passwordHash: { type: String },

    role: {
      type: String,
      enum: ["admin", "subOrgAdmin", "educator", "learner"], // 👈 educator
      required: true,
    },

    subOrgId: { type: mongoose.Schema.Types.ObjectId, ref: "SubOrg" }, // 👈 link

    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active",
    },

    lastLoginAt: { type: Date },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "OrgUser" },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },


    // 🔍 Educator Verification Fields
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "unverified", null],
      default: null, // for non-educators; you'll set "pending" when creating educator
    },
    verificationNotes: {
      type: String,
      trim: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUser",
    },
    verifiedAt: {
      type: Date,
    },

    // For review history (you already use these in controller)
    verificationReviewedAt: {
      type: Date,
    },
    verificationReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUser",
    },
    verificationReviewReason: {
      type: String,
      trim: true,
    },

    // Store uploaded docs embedded on user (you already push verificationDocs)
    verificationDocs: [
      {
        type: {
          type: String,
          default: "OTHER",
        },
        url: String,
        publicId: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Optional: Educator profile block (matches your spec)
    educatorProfile: {
      title: { type: String, trim: true },
      bio: { type: String, trim: true },
      highestQualification: { type: String, trim: true },
      yearsOfExperience: { type: Number },
      expertiseAreas: [{ type: String, trim: true }],
      languages: [{ type: String, trim: true }],
      linkedinUrl: { type: String, trim: true },
      portfolioUrl: { type: String, trim: true },
    },
  },
  {
    collection: "org_users",
  }
);

module.exports = OrgUserSchema;
