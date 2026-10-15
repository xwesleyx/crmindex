// Lista própria e enxuta (sem depender de um pacote de emoji só pra isto —
// nenhuma dependência nova, carrega instantâneo) — cobre o uso comum de
// atendimento ao cliente, não é o unicode inteiro com busca.
export const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Rostos",
    emojis: [
      "😀", "😁", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😍",
      "🥰", "😘", "😋", "😎", "🤩", "🥳", "😅", "😌", "🤔", "🤗",
      "😐", "😑", "😶", "🙄", "😴", "😪", "😮", "😯", "😢", "😭",
      "😤", "😠", "😡", "🤯", "😳", "🥺", "😬", "😷", "🤒", "🤕",
    ],
  },
  {
    label: "Gestos",
    emojis: [
      "👍", "👎", "👌", "🤝", "🙏", "👏", "🙌", "💪", "✌️", "🤞",
      "👋", "🤙", "☝️", "👆", "👇", "👈", "👉", "✋", "🤚", "💯",
    ],
  },
  {
    label: "Corações",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💕", "💖", "💗", "💓", "💞"],
  },
  {
    label: "Trabalho",
    emojis: [
      "✅", "❌", "⚠️", "❗", "❓", "⭐", "✨", "🔥", "🎉", "🎯",
      "📌", "📎", "📅", "⏰", "⏳", "💰", "💵", "📈", "📉", "📦",
      "🚚", "🔧", "🔨", "⚙️", "💻", "📱", "📞", "✉️", "📄", "📝",
    ],
  },
  {
    label: "Outros",
    emojis: ["☀️", "🌧️", "🏠", "🏢", "🚗", "✈️", "☕", "🍕", "🎂", "🎁"],
  },
];
