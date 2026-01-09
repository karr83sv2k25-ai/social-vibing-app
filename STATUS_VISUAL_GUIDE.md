# User Status System - Visual Guide

## 🎨 UI Components Overview

### 1. Status Selector Modal

```
┌────────────────────────────────────┐
│  Change Status               ✕    │
├────────────────────────────────────┤
│                                    │
│  Current Status: Busy              │
│  ┌──────────────────────────┐ ✕  │
│  └──────────────────────────┘     │
│                                    │
│  ┌─────────────────────────────┐  │
│  │ ✅ Available            ✓   │  │
│  ├─────────────────────────────┤  │
│  │ 🔴 Busy                     │  │
│  ├─────────────────────────────┤  │
│  │ 🟡 Away                     │  │
│  ├─────────────────────────────┤  │
│  │ 🔕 Do Not Disturb           │  │
│  ├─────────────────────────────┤  │
│  │ 📅 In a meeting             │  │
│  ├─────────────────────────────┤  │
│  │ 💬 Custom Status 1          │  │
│  └─────────────────────────────┘  │
│                                    │
│  ┌─────────────────────────────┐  │
│  │  ⊕ Set Custom Status        │  │
│  └─────────────────────────────┘  │
│                                    │
└────────────────────────────────────┘
```

### 2. Profile Screen Integration

```
┌────────────────────────────────────┐
│  ← Profile                    ⚙   │
├────────────────────────────────────┤
│                                    │
│   ┌────┐                          │
│   │ 👤 │  John Doe                │
│   └────┘  @johndoe                │
│           ● Online                 │
│           [● Busy]  ✏️             │
│                                    │
│   #gaming  #tech  #anime          │
│                                    │
│   ┌──────┬──────┬──────┬─────┐   │
│   │ 120  │ 80   │ 45   │ 350 │   │
│   │Fllw's│Fllwng│Frnds │Vists│   │
│   └──────┴──────┴──────┴─────┘   │
│                                    │
└────────────────────────────────────┘
```

### 3. Messages Screen Integration

```
┌────────────────────────────────────┐
│  💬 Messages      [Busy]✏️  🔔  ➕ │
├────────────────────────────────────┤
│                                    │
│  🔍 Search messages...             │
│                                    │
│  ┌────────────────────────────────┐│
│  │ 👤  Alice Cooper              ││
│  │     Hey, are you free?     2m ││
│  │     ● Available                ││
│  ├────────────────────────────────┤│
│  │ 👤  Bob Smith                 ││
│  │     See you tomorrow       1h ││
│  │     ● Do Not Disturb           ││
│  ├────────────────────────────────┤│
│  │ 👤  Carol White               ││
│  │     Thanks! 👍             3h ││
│  │     ● Away                     ││
│  └────────────────────────────────┘│
│                                    │
└────────────────────────────────────┘
```

### 4. Community Screen Integration

```
┌────────────────────────────────────┐
│  👤 John Doe                      │
│  @johndoe · ● Online               │
│  [● In a meeting]  ←Click to edit │
│                                    │
│  🔍  🔔                            │
├────────────────────────────────────┤
│  Explored │ Joined │ Managed      │
├────────────────────────────────────┤
│                                    │
│  Anime & Manga                     │
│                                    │
│  ┌────────┐  ┌────────┐          │
│  │ [IMG]  │  │ [IMG]  │          │
│  │ Anime  │  │ Gaming │          │
│  │ Fans   │  │ Hub    │          │
│  └────────┘  └────────┘          │
│                                    │
└────────────────────────────────────┘
```

### 5. Home Screen (Posts) Integration

```
┌────────────────────────────────────┐
│  🏠 Home          Discovery    ⋮   │
├────────────────────────────────────┤
│                                    │
│  ┌────────────────────────────────┐│
│  │ 👤  Alice Cooper      Follow  ││
│  │     @alice · Dec 22            ││
│  │     ● Available                ││
│  │                                ││
│  │ Just finished an amazing       ││
│  │ coding session! 🎉             ││
│  │                                ││
│  │ [─────────────────]            ││
│  │ [      IMAGE      ]            ││
│  │ [─────────────────]            ││
│  │                                ││
│  │ 💜 23  💬 5  🔄 2  📤         ││
│  └────────────────────────────────┘│
│                                    │
│  ┌────────────────────────────────┐│
│  │ 👤  Bob Smith                 ││
│  │     @bob · Dec 22              ││
│  │     ● Do Not Disturb           ││
│  │                                ││
│  │ Working on something cool...   ││
│  │                                ││
└────────────────────────────────────┘
```

## 🎨 Status Badge Sizes

### Small (24px height)
```
[● Busy]
```

### Medium (28px height)
```
[● Away] ✏️
```

### Large (32px height)
```
[● Available] ✏️
```

## 🎯 Status Indicator Colors

- **Available** - 🟢 Green (#10B981)
- **Busy** - 🔴 Red (#EF4444)
- **Away** - 🟡 Orange (#F59E0B)
- **Do Not Disturb** - 🔴 Dark Red (#DC2626)
- **In a meeting** - 🟣 Purple (#8B5CF6)
- **Custom** - 💜 Brand Purple (#BF2EF0)

## 📱 Interaction Flow

1. **User clicks status badge** anywhere in the app
   ↓
2. **Status Selector modal opens**
   ↓
3. **User selects or creates status**
   ↓
4. **Status saves to Firestore**
   ↓
5. **All connected devices update instantly**
   ↓
6. **Status appears everywhere the user is displayed**

## ✨ Visual Features

- **Smooth animations**: Fade in/out, slide up
- **Real-time indicators**: Pulsing dot for online users
- **Color coding**: Instant visual status recognition
- **Consistent design**: Same look across all screens
- **Touch feedback**: Subtle opacity changes on press
- **Loading states**: Spinners during updates
- **Error handling**: User-friendly error messages

## 🎭 States

### Empty State
```
No status set
[Set Status]
```

### Loading State
```
[⟳ Loading...]
```

### Error State
```
[⚠️ Failed to load]
```

### Active State
```
[● Busy] ✏️
   ↑      ↑
  dot   edit icon
```

## 🔄 Real-Time Updates

When status changes:
1. ⚡ **Instant UI update** (optimistic)
2. 🔄 **Firestore save** (async)
3. 📡 **Broadcast to all devices** (real-time)
4. 💾 **Local cache update** (offline support)

---

**Note**: All UI mockups are text-based representations. Actual implementation uses React Native components with your app's theme colors and styling.
