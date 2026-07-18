import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-session";
import { getPhotoById } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { photoId } = await params;
  const photo = getPhotoById(Number(photoId));

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const safeName = String(photo.file_name || "photo")
    .replace(/[\r\n"]/g, "")
    .replace(/[\\/]/g, "_");

  return new NextResponse(photo.data, {
    headers: {
      "Content-Type": photo.content_type,
      "Content-Disposition": `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
