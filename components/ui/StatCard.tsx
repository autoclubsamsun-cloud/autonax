interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  color?: 'red' | 'green' | 'blue' | 'amber';
  icon: React.ReactNode;
}

const colorMap = { red: '', green: 'g', blue: 'b', amber: 'a' };

export default function StatCard({ label, value, trend, trendUp = true, color = 'red', icon }: StatCardProps) {
  const cls = colorMap[color];
  return (
    <div className={`sk ${cls}`}>
      <div className="sk-icon">{icon}</div>
      <div className="sk-val">{value}</div>
      <div className="sk-lbl">{label}</div>
      {trend && (
        <div className={`sk-trend ${trendUp ? 'up' : 'dn'}`}>
          <svg viewBox="0 0 24 24">
            <polyline points={trendUp ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
          </svg>
          {trend}
        </div>
      )}
    </div>
  );
}
