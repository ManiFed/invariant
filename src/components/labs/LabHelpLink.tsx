import { CircleHelp } from "lucide-react";

type LabHelpLinkProps = {
  href: string;
  label: string;
  className?: string;
};

const LabHelpLink = ({ href, label, className = "" }: LabHelpLinkProps) => {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center w-4 h-4 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground transition-colors ${className}`}
      title={`Methodology: ${label}`}
      aria-label={`Open methodology section: ${label}`}
    >
      <CircleHelp className="w-3 h-3" />
    </a>
  );
};

export default LabHelpLink;
