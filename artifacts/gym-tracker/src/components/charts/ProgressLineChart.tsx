import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface DataPoint {
  date: string;
  [key: string]: any;
}

interface ProgressLineChartProps {
  data: DataPoint[];
  dataKey: string;
  color?: string;
  formatValue?: (val: number) => string;
}

export function ProgressLineChart({ 
  data, 
  dataKey, 
  color = "hsl(var(--chart-1))",
  formatValue = (v) => v.toString() 
}: ProgressLineChartProps) {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(val) => format(new Date(val), "d MMM", { locale: ru })}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis 
            tickFormatter={formatValue}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dx={-10}
            width={60}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem" }}
            labelFormatter={(val) => format(new Date(val), "d MMMM yyyy", { locale: ru })}
            formatter={(value: number) => [formatValue(value), ""]}
          />
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={3} 
            dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--background))" }} 
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
