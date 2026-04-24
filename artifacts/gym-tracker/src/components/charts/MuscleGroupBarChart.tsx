import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatKg } from "@/lib/format";

interface MuscleGroupVolumeItem {
  muscleGroup: string;
  volume: number;
}

interface MuscleGroupBarChartProps {
  data: MuscleGroupVolumeItem[];
}

export function MuscleGroupBarChart({ data }: MuscleGroupBarChartProps) {
  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis 
            type="number" 
            tickFormatter={(val) => `${val/1000}k`}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            dataKey="muscleGroup" 
            type="category" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dx={-10}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted)/0.5)" }}
            contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem" }}
            formatter={(value: number) => [formatKg(value), "Тоннаж"]}
          />
          <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
