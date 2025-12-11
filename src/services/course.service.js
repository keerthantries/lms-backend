// src/services/course.service.js

/**
 * Create a new course (admin or educator).
 */
async function createCourse({ Course, currentUser, data }) {
  if (!data || !data.title) {
    const err = new Error("title is required");
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const slug =
    data.slug ||
    String(data.title)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  // ---- Pricing normalisation (supports old + new payloads) ----
  let rawPrice = 0;
  if (typeof data.price === "number") {
    rawPrice = data.price;
  } else if (data.pricing && typeof data.pricing.price === "number") {
    rawPrice = data.pricing.price;
  }

  let isFree =
    typeof data.pricing?.isFree === "boolean"
      ? data.pricing.isFree
      : rawPrice === 0;

  let discount =
    typeof data.pricing?.discountPercentage === "number"
      ? data.pricing.discountPercentage
      : 0;

  const finalPrice = isFree ? 0 : rawPrice;

  // ---- Status normalisation ----
  const allowedStatuses = ["draft", "published", "archived"];
  const statusFromBody = (data.status || "draft").toLowerCase();
  const finalStatus = allowedStatuses.includes(statusFromBody)
    ? statusFromBody
    : "draft";

  const course = await Course.create({
    title: data.title,
    slug,
    status: finalStatus,

    category: data.category || null,
    level: data.level || null,
    language: data.language || "english",

    // Legacy fields
    price: finalPrice,
    currency: data.currency || "INR",

    // Rich pricing meta
    pricing: {
      isFree,
      price: finalPrice,
      discountPercentage: discount,
    },

    thumbnailUrl: data.thumbnailUrl || null,
    thumbnailName: data.thumbnailName || null,

    subtitle: data.subtitle || null,
    shortDescription: data.shortDescription || data.summary || null,
    fullDescription: data.fullDescription || null,
    summary: data.summary || data.shortDescription || null,

    learningOutcomes: Array.isArray(data.learningOutcomes)
      ? data.learningOutcomes
      : [],
    requirements: Array.isArray(data.requirements)
      ? data.requirements
      : [],

    estimatedDurationHours:
      typeof data.estimatedDurationHours === "number"
        ? data.estimatedDurationHours
        : null,
    totalLessonsPlanned:
      typeof data.totalLessonsPlanned === "number"
        ? data.totalLessonsPlanned
        : null,

    tags: Array.isArray(data.tags) ? data.tags : [],

    seo: {
      metaTitle: data.seo?.metaTitle || data.title,
      metaDescription:
        data.seo?.metaDescription || data.shortDescription || "",
    },

    createdBy: currentUser?.userId || null,
    updatedBy: currentUser?.userId || null,
    createdAt: now,
    updatedAt: now,
  });

  return course.toObject();
}

/**
 * Fetch courses with pagination and status filter.
 * { page, limit, status }
 */
async function listCourses({ Course, query }) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const status = query.status || "All";

  const filter = {};
  if (status && status !== "All") {
    filter.status = status.toLowerCase();
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Course.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Course.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
  };
}

/**
 * Get single course by ID.
 */
async function getCourseById({ Course, courseId }) {
  const course = await Course.findById(courseId).lean();

  if (!course) {
    const err = new Error("Course not found");
    err.statusCode = 404;
    throw err;
  }

  return course;
}

/**
 * Update course metadata + status.
 * This is used by CoursePreviewPage (Save, Approve, Reject, etc).
 */
async function updateCourse({ Course, courseId, updates }) {
  const course = await Course.findById(courseId);

  if (!course) {
    const err = new Error("Course not found");
    err.statusCode = 404;
    throw err;
  }

  if (!updates || typeof updates !== "object") {
    return course.toObject();
  }

  // Basic fields
  if (updates.title !== undefined) course.title = updates.title;
  if (updates.slug !== undefined && updates.slug) course.slug = updates.slug;

  if (updates.category !== undefined) course.category = updates.category;
  if (updates.level !== undefined) course.level = updates.level;
  if (updates.language !== undefined) course.language = updates.language;

  // Status
  if (updates.status !== undefined) {
    const allowedStatuses = ["draft", "published", "archived"];
    const status = String(updates.status).toLowerCase();
    if (!allowedStatuses.includes(status)) {
      const err = new Error("Invalid status");
      err.statusCode = 400;
      throw err;
    }
    course.status = status;
  }

  // Descriptions
  if (updates.subtitle !== undefined) course.subtitle = updates.subtitle;
  if (updates.shortDescription !== undefined)
    course.shortDescription = updates.shortDescription;
  if (updates.fullDescription !== undefined)
    course.fullDescription = updates.fullDescription;
  if (updates.summary !== undefined) course.summary = updates.summary;

  // Arrays
  if (updates.learningOutcomes !== undefined) {
    course.learningOutcomes = Array.isArray(updates.learningOutcomes)
      ? updates.learningOutcomes
      : [];
  }
  if (updates.requirements !== undefined) {
    course.requirements = Array.isArray(updates.requirements)
      ? updates.requirements
      : [];
  }
  if (updates.tags !== undefined) {
    course.tags = Array.isArray(updates.tags) ? updates.tags : [];
  }

  // Duration / planned lessons
  if (updates.estimatedDurationHours !== undefined) {
    course.estimatedDurationHours =
      updates.estimatedDurationHours !== null
        ? Number(updates.estimatedDurationHours)
        : null;
  }
  if (updates.totalLessonsPlanned !== undefined) {
    course.totalLessonsPlanned =
      updates.totalLessonsPlanned !== null
        ? Number(updates.totalLessonsPlanned)
        : null;
  }

  // Thumbnail
  if (updates.thumbnailUrl !== undefined)
    course.thumbnailUrl = updates.thumbnailUrl;
  if (updates.thumbnailName !== undefined)
    course.thumbnailName = updates.thumbnailName;

  // Pricing (nested + legacy)
  let price = course.price ?? 0;
  let isFree =
    course.pricing?.isFree !== undefined
      ? course.pricing.isFree
      : course.price === 0;
  let discount = course.pricing?.discountPercentage ?? 0;

  if (updates.pricing) {
    if (typeof updates.pricing.price === "number") {
      price = updates.pricing.price;
    }
    if (typeof updates.pricing.isFree === "boolean") {
      isFree = updates.pricing.isFree;
    }
    if (typeof updates.pricing.discountPercentage === "number") {
      discount = updates.pricing.discountPercentage;
    }
  }

  if (typeof updates.price === "number") {
    price = updates.price;
  }

  if (typeof updates.currency === "string") {
    course.currency = updates.currency;
  }

  if (updates.pricing || updates.price !== undefined) {
    const finalPrice = isFree ? 0 : price;
    course.price = finalPrice;
    course.pricing = {
      isFree,
      price: finalPrice,
      discountPercentage: discount,
    };
  }

  // SEO
  if (updates.seo) {
    course.seo = course.seo || {};
    if (updates.seo.metaTitle !== undefined) {
      course.seo.metaTitle = updates.seo.metaTitle;
    }
    if (updates.seo.metaDescription !== undefined) {
      course.seo.metaDescription = updates.seo.metaDescription;
    }
  }

  course.updatedAt = new Date();
  await course.save();

  return course.toObject();
}

/**
 * Delete course + all its sections + lessons.
 */
async function deleteCourse({ Course, CourseSection, CourseLesson, courseId }) {
  const course = await Course.findById(courseId);

  if (!course) {
    const err = new Error("Course not found");
    err.statusCode = 404;
    throw err;
  }

  await Promise.all([
    Course.deleteOne({ _id: courseId }),
    CourseSection.deleteMany({ courseId }),
    CourseLesson.deleteMany({ courseId }),
  ]);

  return { success: true };
}

/* ========== CURRICULUM ========== */

/**
 * Fetch curriculum: sections + lessons nested.
 */
async function fetchCurriculum({ CourseSection, CourseLesson, courseId }) {
  const sections = await CourseSection.find({ courseId }).lean();
  const lessons = await CourseLesson.find({ courseId }).lean();

  sections.sort((a, b) => (a.order || 0) - (b.order || 0));
  lessons.sort((a, b) => (a.order || 0) - (b.order || 0));

  const sectionsWithLessons = sections.map((sec) => ({
    ...sec,
    lessons: lessons.filter(
      (l) => String(l.sectionId) === String(sec._id)
    ),
  }));

  return { sections: sectionsWithLessons };
}

/**
 * Create section for a course.
 */
async function createSection({ Course, CourseSection, courseId, title }) {
  if (!title) {
    const err = new Error("title is required");
    err.statusCode = 400;
    throw err;
  }

  const course = await Course.findById(courseId).lean();
  if (!course) {
    const err = new Error("Course not found");
    err.statusCode = 404;
    throw err;
  }

  const existingForCourse = await CourseSection.countDocuments({ courseId });

  const section = await CourseSection.create({
    courseId,
    title,
    order: existingForCourse + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return section.toObject();
}

/**
 * Update section.
 */
async function updateSection({ CourseSection, sectionId, updates }) {
  const section = await CourseSection.findById(sectionId);

  if (!section) {
    const err = new Error("Section not found");
    err.statusCode = 404;
    throw err;
  }

  if (updates.title !== undefined) section.title = updates.title;
  if (updates.order !== undefined) section.order = updates.order;

  section.updatedAt = new Date();
  await section.save();

  return section.toObject();
}

/**
 * Delete section and its lessons.
 */
async function deleteSection({ CourseSection, CourseLesson, sectionId }) {
  const section = await CourseSection.findById(sectionId);

  if (!section) {
    const err = new Error("Section not found");
    err.statusCode = 404;
    throw err;
  }

  await Promise.all([
    CourseSection.deleteOne({ _id: sectionId }),
    CourseLesson.deleteMany({ sectionId }),
  ]);

  return { success: true };
}

/* ========== LESSONS ========== */

/**
 * Create lesson under section.
 * Supports:
 * - videoSource: "upload" | "youtube" | "sharepoint"
 * - videoUrl: external url for youtube/sharepoint
 * - textContent: for text-based lessons
 */
async function createLesson({
  Course,
  CourseSection,
  CourseLesson,
  courseId,
  sectionId,
  payload,
}) {
  if (!payload || !payload.title) {
    const err = new Error("title is required");
    err.statusCode = 400;
    throw err;
  }

  const course = await Course.findById(courseId).lean();
  if (!course) {
    const err = new Error("Course not found");
    err.statusCode = 404;
    throw err;
  }

  const section = await CourseSection.findOne({
    _id: sectionId,
    courseId,
  }).lean();
  if (!section) {
    const err = new Error("Section not found for this course");
    err.statusCode = 404;
    throw err;
  }

  const existingForSection = await CourseLesson.countDocuments({ sectionId });

  // decide source
  let videoSource = payload.videoSource || "upload";
  let videoUrl = payload.videoUrl || null;

  // normalize: if we have videoUrl but no explicit source, default to youtube
  if (!payload.videoSource && payload.videoUrl) {
    videoSource = "youtube";
  }

  // if using upload, ignore videoUrl
  if (videoSource === "upload") {
    videoUrl = null;
  }

  const lesson = await CourseLesson.create({
    courseId,
    sectionId,
    title: payload.title,
    type: payload.type || "video",

    videoSource,
    videoUrl,

    textContent: payload.textContent || null,

    resourceUrl: null,
    resourcePublicId: null,

    isPreview: Boolean(payload.isPreview),
    durationMinutes: payload.durationMinutes || null,
    order: existingForSection + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return lesson.toObject();
}

/**
 * Update lesson.
 */
async function updateLesson({ CourseLesson, lessonId, updates }) {
  const lesson = await CourseLesson.findById(lessonId);

  if (!lesson) {
    const err = new Error("Lesson not found");
    err.statusCode = 404;
    throw err;
  }

  if (updates.title !== undefined) lesson.title = updates.title;
  if (updates.type !== undefined) lesson.type = updates.type;
  if (updates.isPreview !== undefined) lesson.isPreview = updates.isPreview;
  if (updates.durationMinutes !== undefined) {
    lesson.durationMinutes = updates.durationMinutes;
  }
  if (updates.order !== undefined) lesson.order = updates.order;

  // text content
  if (updates.textContent !== undefined) {
    lesson.textContent = updates.textContent;
  }

  // Handle videoSource + videoUrl
  let newVideoSource = updates.videoSource;
  let newVideoUrl = updates.videoUrl;

  // case 1: they ONLY sent videoUrl, infer source (default youtube)
  if (newVideoSource === undefined && newVideoUrl !== undefined) {
    newVideoSource = "youtube";
  }

  if (newVideoSource !== undefined) {
    if (!["upload", "youtube", "sharepoint"].includes(newVideoSource)) {
      const err = new Error("videoSource must be upload | youtube | sharepoint");
      err.statusCode = 400;
      throw err;
    }

    // if switching to upload explicitly, clear external url
    if (newVideoSource === "upload") {
      lesson.videoSource = "upload";
      lesson.videoUrl = null;
      // resourceUrl/Id remain as they are (or null if not set yet)
    } else {
      // youtube or sharepoint → require url
      if (!newVideoUrl && !lesson.videoUrl) {
        const err = new Error("videoUrl is required for youtube/sharepoint");
        err.statusCode = 400;
        throw err;
      }
      lesson.videoSource = newVideoSource;
      if (newVideoUrl) {
        lesson.videoUrl = newVideoUrl;
      }
      // external source ⇒ clear Cloudinary upload references
      lesson.resourceUrl = null;
      lesson.resourcePublicId = null;
    }
  } else if (newVideoUrl !== undefined) {
    // only URL changed, keep existing source
    if (["youtube", "sharepoint"].includes(lesson.videoSource)) {
      lesson.videoUrl = newVideoUrl;
    } else {
      // if it was upload but now URL is given, assume youtube
      lesson.videoSource = "youtube";
      lesson.videoUrl = newVideoUrl;
      lesson.resourceUrl = null;
      lesson.resourcePublicId = null;
    }
  }

  lesson.updatedAt = new Date();
  await lesson.save();

  return lesson.toObject();
}

/**
 * Delete lesson.
 */
async function deleteLesson({ CourseLesson, lessonId }) {
  const lesson = await CourseLesson.findById(lessonId);

  if (!lesson) {
    const err = new Error("Lesson not found");
    err.statusCode = 404;
    throw err;
  }

  await CourseLesson.deleteOne({ _id: lessonId });

  return { success: true };
}

/**
 * Attach Cloudinary material to lesson.
 */
async function attachLessonMaterial({
  CourseLesson,
  lessonId,
  resourceUrl,
  resourcePublicId,
}) {
  const lesson = await CourseLesson.findById(lessonId);

  if (!lesson) {
    const err = new Error("Lesson not found");
    err.statusCode = 404;
    throw err;
  }

  // If we upload a file, this becomes the source of truth
  lesson.resourceUrl = resourceUrl;
  lesson.resourcePublicId = resourcePublicId || null;
  lesson.videoSource = "upload";
  lesson.videoUrl = null; // clear external url

  lesson.updatedAt = new Date();
  await lesson.save();

  return lesson.toObject();
}

module.exports = {
  createCourse,
  listCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  fetchCurriculum,
  createSection,
  updateSection,
  deleteSection,
  createLesson,
  updateLesson,
  deleteLesson,
  attachLessonMaterial,
};
