import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type CopyableIdProps = {
  value: string | number;
  label?: string;
};

export default function CopyableId({ value, label = "ID" }: CopyableIdProps) {
  const text = String(value);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label}`);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <code className="font-mono text-sm">{text}</code>
      <Button type="button" variant="ghost" size="sm" onClick={copy} title={`Copy ${label}`}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}
