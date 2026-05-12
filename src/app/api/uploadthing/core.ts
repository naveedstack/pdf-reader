import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  // Define a route strictly for PDFs, up to 32MB
  pdfUploader: f({ pdf: { maxFileSize: "32MB", maxFileCount: 1 } })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code runs on your Next.js server after the upload finishes
      console.log("Upload complete for url:", file.url);
      return { fileUrl: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;