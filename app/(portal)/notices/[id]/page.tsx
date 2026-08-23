import { notFound } from "next/navigation";

import { notices } from "@/lib/data/seed";
import { NoticeDetail } from "./NoticeDetail";

export function generateStaticParams() {
  return notices.map((n) => ({ id: n.id }));
}

export default async function NoticePage({ params }: PageProps<"/notices/[id]">) {
  const { id } = await params;
  const notice = notices.find((n) => n.id === id);
  if (!notice) notFound();

  return <NoticeDetail notice={notice} />;
}
