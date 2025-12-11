const mongoose = require("mongoose");

const OrgSettingsSchema = new mongoose.Schema(
  {
    branding: {
      logoUrl: { type: String },
      logoPublicId: { type: String },
      faviconUrl: { type: String },
      primaryColor: { type: String, default: "#2E5BFF" },
      secondaryColor: { type: String, default: "#F2F4FF" },
    },
    authPreferences: {
      allowEmailPasswordLogin: { type: Boolean, default: true },
      allowPhoneOtpLogin: { type: Boolean, default: false },
      b2cLearnerSignupEnabled: { type: Boolean, default: true },
      b2cInstructorSignupEnabled: { type: Boolean, default: false },
    },
    courseBuilderSettings: {
      maxActiveCourses: { type: Number, default: 100 },
      maxDraftCourses: { type: Number, default: 200 },
    },
    notifications: {
      emailFromName: { type: String, default: "Vidhyapat LMS" },
      emailFromAddress: { type: String },
      sendEnrollmentEmails: { type: Boolean, default: true },
      sendCompletionEmails: { type: Boolean, default: true },
      sendCertificateEmails: { type: Boolean, default: true },
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "org_settings",
  }
);

module.exports = OrgSettingsSchema;
