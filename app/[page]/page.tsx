import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";

const pageKeys = ["inicio", "vendas", "metas", "campanhas", "rankings", "equipe", "importacao-bi", "relatorios", "configuracoes"] as const;

export function generateStaticParams() {
  return pageKeys.filter((page) => page !== "inicio").map((page) => ({ page }));
}

export default async function Section({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!pageKeys.includes(page as (typeof pageKeys)[number]) || page === "inicio") notFound();
  return <Dashboard page={page as (typeof pageKeys)[number]} />;
}
