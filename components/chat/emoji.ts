// The full reaction picker: a curated set, grouped. Anything not here can be
// typed with the phone's emoji keyboard into the picker's "any emoji" field,
// so no emoji library is shipped.
export const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😜 🤪 😎 🥳 🤗 🤭 🤫 🤔 😐 😏 😌 😴 🥹 😢 😭 😤 😡 🤯 😳 🥺 😱 😮 🙄 😬 🫠 🫡 🤝'.split(' '),
  },
  {
    label: 'Hands & people',
    emojis: '👍 👎 👏 🙌 👐 🙏 🤲 ✌️ 🤞 🤟 🤘 👌 🫶 💪 👋 ✋ 🖐️ ☝️ 👆 👇 👉 👈 🫵 🙋 🙇 🤷 🤦 💃 🕺 👀'.split(' '),
  },
  {
    label: 'Hearts & praise',
    emojis: '❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 💖 💗 💕 💞 ❣️ 💯 ✨ 🔥 ⭐ 🌟 ⚡ 🕊️ ✝️ 🛐 📖 🙏🏽 🙌🏽 🎉 🎊 👑 🏆'.split(' '),
  },
  {
    label: 'Music',
    emojis: '🎶 🎵 🎤 🎧 🎹 🎸 🥁 🎷 🎺 🎻 🪕 📯 🔊 🎙️ 🎼'.split(' '),
  },
  {
    label: 'Things',
    emojis: '☕ 🍕 🍔 🍩 🎂 🍿 🥤 🚗 ✈️ ⏰ 📅 📍 📸 🎬 💡 📌 ✅ ❌ ❓ ❗ 💤 🏠 ⛪ 🌈 ☀️ 🌧️ ❄️ 🌹 🌻 🍀'.split(' '),
  },
];
