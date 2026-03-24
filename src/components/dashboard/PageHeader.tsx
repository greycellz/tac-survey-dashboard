import CompareBar from "./CompareBar";

interface PageHeaderProps {
  title: string;
  description: string;
}

export default function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          <p className="text-sm text-text-muted mt-1">{description}</p>
        </div>
        <div className="shrink-0 mt-1">
          <CompareBar />
        </div>
      </div>
      <div className="mt-4 border-b border-border" />
    </div>
  );
}
