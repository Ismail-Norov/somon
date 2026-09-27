import { BackLink } from '@/components/ui/BackLink';

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href?: string; label: string };
};

export function PageHeader({ title, subtitle, actions, back }: Props) {
  return (
    <>
      {back && <BackLink href={back.href} label={back.label} />}
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    </>
  );
}
