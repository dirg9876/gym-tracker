import { Linking, Text, View } from "react-native";
import { useState } from "react";
import Svg, { G, Path } from "react-native-svg";
import anatomy from "@/assets/anatomy/muscles.json";
import { exerciseAnatomy, MUSCLES, type Muscle } from "@/lib/exerciseAnatomy";
import { useColors } from "@/hooks/useColors";

export function ExerciseAnatomy({ exercise }: { exercise: { name: string; muscleGroup: string } }) {
  const colors = useColors(), info = exerciseAnatomy(exercise);
  const [availableWidth, setAvailableWidth] = useState(280);
  const diagramWidth = Math.max(1, (availableWidth - 16) / 2);
  const text = { fontSize: 13, lineHeight: 20, color: colors.foreground };
  const lists = [{ title: "Основная работа", muscles: info.primary, color: colors.primary },
    { title: "Помогают движению", muscles: info.secondary, color: colors.accent }];
  const fill = (slug: string) => info.primary.includes(slug as Muscle) ? colors.primary : info.secondary.includes(slug as Muscle) ? colors.accent : colors.cardBorder;
  return <View style={{ gap: 18 }}>
    <View onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)} style={{ flexDirection: "row", gap: 16 }} accessible accessibilityLabel={`Мышечная карта. Основные: ${info.primary.map(id => MUSCLES[id]).join(", ") || "не уточнены"}. Вспомогательные: ${info.secondary.map(id => MUSCLES[id]).join(", ") || "не уточнены"}.`}>
      {(["front", "back"] as const).map(side => <View key={side} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 6 }}>
        <Svg width={diagramWidth} height={240} viewBox="0 0 724 1448" accessible={false}>
          <G transform={side === "back" ? "translate(-724 0)" : undefined}>
          {anatomy[side].flatMap(part => part.paths.map((d, index) => <Path key={`${part.slug}-${index}`} d={d} fill={fill(part.slug)} stroke={colors.background} strokeWidth={1.5} />))}
          </G>
        </Svg>
        <Text style={{ ...text, color: colors.mutedForeground, fontSize: 11 }}>{side === "front" ? "Спереди" : "Сзади"}</Text>
      </View>)}
    </View>
    {lists.filter(list => list.muscles.length).map(list => <View key={list.title} style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><View style={{ width: 10, height: 10, backgroundColor: list.color, borderRadius: 2 }} /><Text style={{ ...text, fontFamily: "Inter_600SemiBold" }}>{list.title}</Text></View>
      <Text style={text}>{list.muscles.map(id => MUSCLES[id]).join(" · ")}</Text>
    </View>)}
    {info.stabilizers.length ? <Text style={{ ...text, color: colors.mutedForeground }}>Стабилизируют: {info.stabilizers.map(id => MUSCLES[id]).join(" · ")}</Text> : null}
    {info.note ? <Text style={{ ...text, color: colors.mutedForeground }}>{info.note}</Text> : null}
    <View style={{ borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 16, gap: 10 }}>
      <Text style={{ ...text, fontSize: 16, fontFamily: "Inter_700Bold" }}>Техника</Text>
      {info.cues.map((cue, index) => <View key={cue} style={{ flexDirection: "row", gap: 10 }}><Text style={{ ...text, color: colors.accent }}>{index + 1}.</Text><Text style={{ ...text, flex: 1 }}>{cue}</Text></View>)}
      <Text style={{ ...text, color: colors.mutedForeground, fontSize: 11 }}>Схема укрупнённая, не измерение активации мышц. При боли остановите упражнение.</Text>
    </View>
    <Text accessibilityRole="link" onPress={() => { void Linking.openURL(anatomy.source); }} style={{ ...text, fontSize: 11, color: colors.mutedForeground, minHeight: 44, paddingVertical: 12 }}>Анатомическая схема · ELABBASSI Hicham · MIT</Text>
  </View>;
}
