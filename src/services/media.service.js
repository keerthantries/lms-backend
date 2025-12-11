// src/services/media.service.js
const cloudinary = require("../config/cloudinary");

const ORG_LOGO_FOLDER =
  process.env.CLOUDINARY_ORG_LOGO_FOLDER || "org-logos";
const ORG_FAVICON_FOLDER =
  process.env.CLOUDINARY_ORG_FAVICON_FOLDER || "org-favicons";
const EDUCATOR_DOC_FOLDER =
  process.env.CLOUDINARY_EDUCATOR_DOC_FOLDER || "educator-docs";

/**
 * Internal helper: upload raw buffer to Cloudinary.
 */
function uploadBufferToCloudinary(
  buffer,
  {
    folder,
    publicIdPrefix,
    type = "upload",          // default public upload
    resource_type = "image",  // default image
    format,                   // optional (only for logos/icons)
  } = {}
) {
  return new Promise((resolve, reject) => {
    if (
      !cloudinary ||
      !cloudinary.uploader ||
      !cloudinary.uploader.upload_stream
    ) {
      return reject(
        new Error("Cloudinary is not configured correctly (uploader missing)")
      );
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicIdPrefix
          ? `${publicIdPrefix}-${Date.now()}`
          : undefined,
        resource_type,  // use passed value
        type,           // use passed value
        format,         // only used when provided
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          type: result.type,
        });
      }
    );

    stream.end(buffer);
  });
}

/**
 * Upload organization logo (buffer, image-only, public).
 */
async function uploadOrgLogo(buffer, orgSlug) {
  const folder = `${ORG_LOGO_FOLDER}/${orgSlug}`;
  const { url, publicId } = await uploadBufferToCloudinary(buffer, {
    folder,
    publicIdPrefix: `logo-${orgSlug}`,
    type: "upload",
    resource_type: "image",
    format: "png", // normalize logos to PNG
  });

  return {
    logoUrl: url,
    logoPublicId: publicId,
  };
}

/**
 * Upload organization favicon (buffer, image-only, public).
 */
async function uploadOrgFavicon(buffer, orgSlug) {
  const folder = `${ORG_FAVICON_FOLDER}/${orgSlug}`;
  const { url, publicId } = await uploadBufferToCloudinary(buffer, {
    folder,
    publicIdPrefix: `favicon-${orgSlug}`,
    type: "upload",
    resource_type: "image",
    format: "png",
  });

  return {
    faviconUrl: url,
    faviconPublicId: publicId,
  };
}

/**
 * Upload educator document (authenticated/private, image or PDF).
 */
async function uploadEducatorDoc(buffer, orgSlug, educatorId) {
  const folder = `${EDUCATOR_DOC_FOLDER}/${orgSlug}/${educatorId}`;

  const { url, publicId, resourceType, type } = await uploadBufferToCloudinary(
    buffer,
    {
      folder,
      publicIdPrefix: `doc-${educatorId}`,
      type: "authenticated", // NOT public
      resource_type: "auto", // allow image/pdf/etc
      // no format: keep original file type
    }
  );

  return {
    url,
    publicId,
    resourceType,
    type,
  };
}

module.exports = {
  uploadOrgLogo,
  uploadOrgFavicon,
  uploadEducatorDoc,
};
