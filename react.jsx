/** @jsxImportSource @jitl/opentui-react */

import { createCliRenderer, TextAttributes } from "@jitl/opentui-core"
import { createRoot, useKeyboard, useRenderer, useTerminalDimensions } from "@jitl/opentui-react"
import React from "react"
import { useEffect, useMemo, useRef, useState } from "react"

const palette = ["#20f6ff", "#7c5cff", "#ff3df2", "#ffbf3d", "#5dff9b"]
const dragPalette = ["#20f6ff", "#ff3df2", "#ffbf3d", "#5dff9b", "#7c5cff", "#ff6b6b", "#8cfffb"]
const sparkPalette = ["#ffffff", "#ffe9c2", "#fff48f", "#c2faff", "#ffc2f0", "#a8ffd0", "#ffb1f3"]
const sparkChars = ["·", "*", "+", "•", "✦", "✧", "◦"]

const shapeBlueprints = [
  { id: "dvd", kind: "dvd", label: "DVD", color: "#ffbf3d", x: 46, y: 4, vx: 0.62, vy: 0.36 },
  { id: "diamond", kind: "diamond", label: "JSX", color: "#20f6ff", x: 8, y: 7, vx: 0.42, vy: 0.18 },
  { id: "capsule", kind: "capsule", label: "NODE", color: "#ff3df2", x: 36, y: 9, vx: -0.32, vy: 0.24 },
  { id: "stack", kind: "stack", label: "REACT", color: "#5dff9b", x: 66, y: 6, vx: 0.24, vy: 0.3 },
  { id: "spark", kind: "spark", label: "TUI", color: "#ffbf3d", x: 18, y: 19, vx: 0.52, vy: -0.16 },
  { id: "frame", kind: "frame", label: "CORE", color: "#7c5cff", x: 58, y: 20, vx: -0.46, vy: -0.2 },
  { id: "ribbon", kind: "ribbon", label: "HOOKS", color: "#8cfffb", x: 90, y: 14, vx: -0.28, vy: 0.34 },
]

const shapeSizes = {
  dvd: { width: 22, height: 6 },
  diamond: { width: 13, height: 5 },
  capsule: { width: 18, height: 3 },
  stack: { width: 16, height: 5 },
  spark: { width: 11, height: 5 },
  frame: { width: 15, height: 5 },
  ribbon: { width: 19, height: 4 },
}

const MAX_PARTICLES = 140
const MAX_EVENTS = 5
const MAX_TRAIL = 10
const MAX_RIPPLES = 10
const EQ_BARS = 24

let nextParticleId = 1
let nextEventId = 1
let nextRippleId = 1

function parseDuration(argv) {
  const durationArg = argv.find((arg) => arg.startsWith("--duration="))
  if (durationArg) return Number(durationArg.split("=")[1])
  const index = argv.indexOf("--duration")
  if (index !== -1) return Number(argv[index + 1])
  return null
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function boundsFor(shape, width, height) {
  return {
    maxX: Math.max(0, width - shape.width - 1),
    maxY: Math.max(0, height - shape.height - 1),
  }
}

function seedShapes(width, height) {
  return shapeBlueprints.map((shape, index) => {
    const size = shapeSizes[shape.kind]
    const xOffset = width < 84 ? index * 5 : 0
    const yOffset = height < 24 ? index % 3 : 0
    const seeded = { ...shape, ...size, index, x: shape.x + xOffset, y: shape.y + yOffset }
    const bounds = boundsFor(seeded, width, height)
    return {
      ...seeded,
      colorIndex: Math.max(0, dragPalette.indexOf(seeded.color)),
      x: clamp(seeded.x, 1, bounds.maxX),
      y: clamp(seeded.y, 4, bounds.maxY),
    }
  })
}

function shapeLines(shape, tick, active) {
  const twinkle = tick % 2 === 0 ? "*" : "+"
  const hot = active ? "!" : " "

  switch (shape.kind) {
    case "dvd":
      return ["  ___   _   _  ___  ", " |   \\ | | | ||   \\ ", " | |) || |_| || |) |", " |___/  \\___/ |___/ ", "    V I D E O       ", active ? "   CORNER HUNTING   " : "   BOUNCE MODE      "]
    case "diamond":
      return ["    /\\    ", "   /  \\   ", `  < ${shape.label} >  `, "   \\  /   ", "    \\/    "]
    case "capsule":
      return [` .-${"-".repeat(10)}-. `, `( ${hot}${shape.label.padEnd(8, " ")}${hot} )`, ` '-${"-".repeat(10)}-' `]
    case "stack":
      return ["  ________  ", ` / ${shape.label.padEnd(6, " ")} /|`, "/________/ |", "|        | /", "|________|/ "]
    case "spark":
      return [`  ${twinkle}  |  ${twinkle}`, " \\   |   /", `-- ${shape.label} --`, " /   |   \\", `  ${twinkle}  |  ${twinkle}`]
    case "frame":
      return ["+-----------+", `| ${shape.label.padEnd(9, " ")} |`, "| [=====>] |", "|   JSX    |", "+-----------+"]
    case "ribbon":
      return ["/==============\\", `> ${shape.label.padEnd(11, " ")} <`, "\\==============/", active ? "   DRAG MODE    " : "   INERTIA      "]
    default:
      return [shape.label]
  }
}

function makeParticle(x, y, opts = {}) {
  const angle = opts.angle ?? Math.random() * Math.PI * 2
  const speed = opts.speed ?? 0.4 + Math.random() * 1.1
  const maxLife = opts.maxLife ?? 14 + Math.floor(Math.random() * 16)
  return {
    id: nextParticleId++,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed * 0.65 - 0.08,
    life: 0,
    maxLife,
    color: opts.color ?? sparkPalette[Math.floor(Math.random() * sparkPalette.length)],
    char: opts.char ?? sparkChars[Math.floor(Math.random() * sparkChars.length)],
  }
}

function burstAt(x, y, count, baseColor) {
  const out = []
  for (let i = 0; i < count; i++) {
    out.push(
      makeParticle(x, y, {
        angle: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 1.4,
        color: Math.random() < 0.55 ? baseColor : sparkPalette[Math.floor(Math.random() * sparkPalette.length)],
      }),
    )
  }
  return out
}

function Ripples({ ripples }) {
  return (
    <>
      {ripples.flatMap((r) => {
        const frac = r.age / r.maxAge
        if (frac >= 1) return []
        const baseRadius = 2 + r.age * 1.4
        return [0, 1].map((ring) => {
          const radius = Math.round(baseRadius + ring * 1.5)
          const halfW = radius
          const halfH = Math.max(1, Math.round(radius / 2))
          const left = r.cx - halfW
          const top = r.cy - halfH
          const w = halfW * 2
          const h = halfH * 2
          if (w < 2 || h < 2) return null
          const opacity = Math.max(0, (1 - frac) * (ring === 0 ? 0.55 : 0.25))
          return (
            <box
              key={`ripple-${r.id}-${ring}`}
              position="absolute"
              left={left}
              top={top}
              width={w}
              height={h}
              zIndex={3 + ring}
              opacity={opacity}
              border
              borderStyle="rounded"
              borderColor={r.color}
            />
          )
        })
      })}
    </>
  )
}

function ParticleField({ particles }) {
  return (
    <>
      {particles.map((p) => {
        const lifeFrac = p.life / p.maxLife
        if (lifeFrac >= 1) return null
        const opacity = Math.max(0.1, 1 - lifeFrac)
        return (
          <box
            key={`p-${p.id}`}
            position="absolute"
            left={Math.round(p.x)}
            top={Math.round(p.y)}
            width={1}
            height={1}
            zIndex={70}
            opacity={opacity}
          >
            <text
              selectable={false}
              fg={p.color}
              attributes={lifeFrac < 0.45 ? TextAttributes.BOLD : TextAttributes.DIM}
            >
              {p.char}
            </text>
          </box>
        )
      })}
    </>
  )
}

function MouseCursor({ trail, current, tick }) {
  if (!current || current.x < 0 || current.y < 0) return null
  return (
    <>
      {trail.map((point, i) => {
        const fade = 1 - i / Math.max(1, trail.length)
        return (
          <box
            key={`mt-${point.t}-${i}`}
            position="absolute"
            left={point.x}
            top={point.y}
            width={1}
            height={1}
            zIndex={85}
            opacity={Math.max(0.08, fade * 0.7)}
          >
            <text selectable={false} fg={sparkPalette[(point.t + i) % sparkPalette.length]}>
              {sparkChars[i % sparkChars.length]}
            </text>
          </box>
        )
      })}
      <box position="absolute" left={current.x} top={current.y} width={1} height={1} zIndex={120}>
        <text selectable={false} fg="#ffffff" attributes={TextAttributes.BOLD}>
          {tick % 4 < 2 ? "✦" : "✧"}
        </text>
      </box>
    </>
  )
}

function EqualizerStrip({ bars, tick }) {
  return (
    <box flexDirection="row" gap={0} height={5} alignItems="flex-end">
      {bars.map((value, i) => {
        const h = Math.max(1, Math.round(value * 5))
        const color = palette[(i + Math.floor(tick / 5)) % palette.length]
        return (
          <box
            key={`eq-${i}`}
            flexDirection="column"
            alignItems="center"
            justifyContent="flex-end"
            width={2}
            height={5}
          >
            <box width={1} height={h} backgroundColor={color} />
          </box>
        )
      })}
    </box>
  )
}

function StatBar({ label, value, color }) {
  return (
    <box flexDirection="column" gap={0}>
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <text selectable={false} fg="#d7ddff" attributes={TextAttributes.BOLD}>
          {label}
        </text>
        <text selectable={false} fg="#8490bb" attributes={TextAttributes.DIM}>
          {`${Math.round(value).toString().padStart(2, "0")}%`}
        </text>
      </box>
      <box height={1} backgroundColor="#151a33">
        <box width={`${Math.max(4, value)}%`} height={1} backgroundColor={color} />
      </box>
    </box>
  )
}

function SignalDots({ tick }) {
  const dots = useMemo(() => Array.from({ length: 18 }, (_, index) => index), [])

  return (
    <box flexDirection="row" gap={1} height={1}>
      {dots.map((dot) => (
        <text
          key={dot}
          selectable={false}
          fg={palette[(dot + Math.floor(tick / 4)) % palette.length]}
          attributes={(dot + tick) % 5 === 0 ? TextAttributes.BOLD : TextAttributes.DIM}
        >
          {(dot + tick) % 4 === 0 ? "*" : "."}
        </text>
      ))}
    </box>
  )
}

function ShapeTrail({ shape, tick }) {
  const speed = Math.min(1, Math.abs(shape.vx) + Math.abs(shape.vy))
  if (speed < 0.08) return null

  const ghosts = [1, 2, 3]
  return (
    <>
      {ghosts.map((ghost) => (
        <box
          key={`${shape.id}-trail-${ghost}`}
          position="absolute"
          left={Math.round(shape.x - shape.vx * ghost * 3)}
          top={Math.round(shape.y - shape.vy * ghost * 3)}
          width={Math.max(4, shape.width - ghost * 2)}
          height={Math.max(1, shape.height - ghost)}
          zIndex={24 - ghost}
          opacity={(0.22 - ghost * 0.045) * (0.7 + speed * 0.3)}
          backgroundColor={dragPalette[(shape.index + ghost + Math.floor(tick / 5)) % dragPalette.length]}
          border={ghost === 1}
          borderStyle="rounded"
          borderColor={shape.color}
        />
      ))}
    </>
  )
}

function FloatingShape({ shape, tick, active, onMouseDown, onMouseDrag, onMouseDragEnd, onMouseUp, onMouseOver, onMouseOut }) {
  const lines = shapeLines(shape, tick, active)
  const isDvd = shape.kind === "dvd"

  return (
    <box
      position="absolute"
      left={Math.round(shape.x)}
      top={Math.round(shape.y)}
      width={shape.width}
      height={shape.height}
      zIndex={active ? 80 : isDvd ? 60 : 40 + shape.index}
      opacity={active || isDvd ? 1 : 0.88}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      backgroundColor={active ? "#11172d" : isDvd ? "#050711" : "transparent"}
      border={active || shape.kind === "capsule" || shape.kind === "frame" || shape.kind === "dvd"}
      borderStyle={active ? "double" : "rounded"}
      borderColor={shape.color}
      focusable
      onMouseDown={onMouseDown}
      onMouseDrag={onMouseDrag}
      onMouseDragEnd={onMouseDragEnd}
      onMouseUp={onMouseUp}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
    >
      {lines.map((line, index) => (
        <text
          key={`${shape.id}-${index}`}
          selectable={false}
          content={line}
          fg={index === 2 || active ? shape.color : dragPalette[(shape.index + index + Math.floor(tick / 6)) % dragPalette.length]}
          attributes={active || index === 2 ? TextAttributes.BOLD : undefined}
        />
      ))}
    </box>
  )
}

function RuntimeCard({ tick, width, height }) {
  const pulse = (phase, min = 20, max = 98) => {
    const wave = (Math.sin(tick / 9 + phase) + 1) / 2
    return min + wave * (max - min)
  }

  return (
    <box
      title=" React State "
      border
      borderStyle="rounded"
      borderColor="#20f6ff"
      backgroundColor="#080b18"
      padding={1}
      flexDirection="column"
      gap={1}
      flexGrow={1}
      minWidth={32}
    >
      <text selectable={false} fg="#ffffff" attributes={TextAttributes.BOLD}>
        Hooks are driving OpenTUI renderables
      </text>
      <SignalDots tick={tick} />
      <StatBar label="useState" value={pulse(0)} color="#20f6ff" />
      <StatBar label="useEffect" value={pulse(1.7)} color="#ff3df2" />
      <StatBar label="reconciler" value={pulse(3.4)} color="#5dff9b" />
      <text selectable={false} fg="#8490bb" attributes={TextAttributes.DIM}>
        {`terminal: ${width} x ${height} cells`}
      </text>
    </box>
  )
}

function JsxCard({ tick }) {
  const code = [
    "function App() {",
    "  const [tick, setTick] = useState(0)",
    "  return <box border><text>JSX!</text></box>",
    "}",
  ]

  return (
    <box
      title=" Real JSX "
      border
      borderStyle="rounded"
      borderColor="#ffbf3d"
      backgroundColor="#0b0d18"
      padding={1}
      flexDirection="column"
      gap={1}
      width={38}
      minWidth={30}
    >
      <text selectable={false} fg="#ffbf3d" attributes={TextAttributes.BOLD}>
        @jitl/opentui-react
      </text>
      {code.map((line, index) => (
        <text selectable={false} key={line} fg={index === 2 ? "#5dff9b" : "#cdd4f6"}>
          {line}
        </text>
      ))}
      <box height={1} backgroundColor="#151a33">
        <box width={`${20 + ((tick * 3) % 80)}%`} height={1} backgroundColor="#7c5cff" />
      </box>
      <text selectable={false} fg="#8490bb" attributes={TextAttributes.DIM}>
        JSX runtime: @jitl/opentui-react
      </text>
    </box>
  )
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 200)
    return () => clearInterval(t)
  }, [])
  const ms = now.getMilliseconds().toString().padStart(3, "0")
  return (
    <text selectable={false} fg="#dfe5ff" attributes={TextAttributes.BOLD}>
      {now.toLocaleTimeString()}.{ms.slice(0, 2)}
    </text>
  )
}

function TelemetryCard({ tick, fps, particleCount, events, paused, bars }) {
  return (
    <box
      title=" Telemetry "
      border
      borderStyle="rounded"
      borderColor="#5dff9b"
      backgroundColor="#070c17"
      padding={1}
      flexDirection="column"
      gap={1}
      width={38}
      minWidth={30}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text
          selectable={false}
          fg={paused ? "#ffbf3d" : "#5dff9b"}
          attributes={TextAttributes.BOLD}
        >
          {paused ? "⏸  PAUSED" : "● LIVE"}
        </text>
        <LiveClock />
      </box>

      <box flexDirection="row" gap={2}>
        <box flexDirection="column">
          <text selectable={false} fg="#8490bb" attributes={TextAttributes.DIM}>
            fps
          </text>
          <text selectable={false} fg="#ffffff" attributes={TextAttributes.BOLD}>
            {fps.toFixed(0).padStart(2, "0")}
          </text>
        </box>
        <box flexDirection="column">
          <text selectable={false} fg="#8490bb" attributes={TextAttributes.DIM}>
            sparks
          </text>
          <text selectable={false} fg="#ffffff" attributes={TextAttributes.BOLD}>
            {particleCount.toString().padStart(3, "0")}
          </text>
        </box>
        <box flexDirection="column">
          <text selectable={false} fg="#8490bb" attributes={TextAttributes.DIM}>
            tick
          </text>
          <text selectable={false} fg="#ffffff" attributes={TextAttributes.BOLD}>
            {tick.toString().padStart(5, "0")}
          </text>
        </box>
      </box>

      <EqualizerStrip bars={bars} tick={tick} />

      <text selectable={false} fg="#7c5cff" attributes={TextAttributes.BOLD}>
        event log
      </text>
      <box flexDirection="column" gap={0} flexGrow={1}>
        {events.length === 0 ? (
          <text selectable={false} fg="#8490bb" attributes={TextAttributes.DIM}>
            (drag a shape to fling it)
          </text>
        ) : (
          events.map((ev, idx) => (
            <text
              key={ev.id}
              selectable={false}
              fg={ev.color}
              attributes={idx === 0 ? TextAttributes.BOLD : TextAttributes.DIM}
            >
              {ev.text}
            </text>
          ))
        )}
      </box>
    </box>
  )
}

function HelpOverlay({ tick }) {
  const rows = [
    { key: "q  /  Esc", desc: "quit the demo" },
    { key: "?", desc: "toggle this help" },
    { key: "Space", desc: "pause / resume animation" },
    { key: "r", desc: "scatter all shapes" },
    { key: "c", desc: "clear particles" },
    { key: "drag", desc: "grab a shape and fling" },
  ]

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      zIndex={200}
      justifyContent="center"
      alignItems="center"
      backgroundColor="transparent"
    >
      <box
        width={52}
        border
        borderStyle="double"
        borderColor={dragPalette[Math.floor(tick / 6) % dragPalette.length]}
        backgroundColor="#0a0d1c"
        padding={2}
        flexDirection="column"
        gap={1}
        alignItems="center"
      >
        <ascii-font
          selectable={false}
          text="HELP"
          font="tiny"
          color={["#20f6ff", "#7c5cff", "#ff3df2", "#ffbf3d", "#5dff9b"]}
        />
        <text selectable={false} fg="#cdd4f6" attributes={TextAttributes.DIM}>
          OpenTUI React keyboard map
        </text>
        <box flexDirection="column" gap={0} width={42}>
          {rows.map((row) => (
            <box key={row.key} flexDirection="row" justifyContent="space-between" height={1}>
              <text selectable={false} fg="#20f6ff" attributes={TextAttributes.BOLD}>
                {row.key}
              </text>
              <text selectable={false} fg="#dfe5ff">
                {row.desc}
              </text>
            </box>
          ))}
        </box>
        <text selectable={false} fg="#8490bb" attributes={TextAttributes.DIM}>
          press ? again to close
        </text>
      </box>
    </box>
  )
}

function App({ duration }) {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const [tick, setTick] = useState(0)
  const [activeId, setActiveId] = useState(null)
  const [shapes, setShapes] = useState(() => seedShapes(width, height))
  const [particles, setParticles] = useState([])
  const [ripples, setRipples] = useState([])
  const [events, setEvents] = useState([])
  const [showHelp, setShowHelp] = useState(false)
  const [paused, setPaused] = useState(false)
  const [bars, setBars] = useState(() => Array(EQ_BARS).fill(0.2))
  const [fps, setFps] = useState(30)
  const [trail, setTrail] = useState([])
  const dragRef = useRef(null)
  const mouseRef = useRef({ x: -1, y: -1 })
  const fpsRef = useRef({ frames: 0, lastTime: Date.now() })

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape" || (key.ctrl && key.name === "c")) {
      renderer.destroy()
      return
    }
    if (key.name === "?" || (key.shift && key.name === "/")) {
      setShowHelp((v) => !v)
      return
    }
    if (key.name === "space") {
      setPaused((v) => !v)
      return
    }
    if (key.name === "r") {
      setShapes((current) =>
        current.map((shape) => ({
          ...shape,
          vx: (Math.random() - 0.5) * 2.4,
          vy: (Math.random() - 0.5) * 1.6,
        })),
      )
      setParticles((current) => {
        const burst = []
        shapes.forEach((s) => {
          burst.push(...burstAt(s.x + s.width / 2, s.y + s.height / 2, 6, s.color))
        })
        return [...current, ...burst].slice(-MAX_PARTICLES)
      })
      setEvents((current) =>
        [
          {
            id: nextEventId++,
            text: `[${tick.toString().padStart(4, "0")}] *** scatter! ***`,
            color: "#ffbf3d",
          },
          ...current,
        ].slice(0, MAX_EVENTS),
      )
      return
    }
    if (key.name === "c") {
      setParticles([])
      return
    }
  })

  useEffect(() => {
    renderer.setTerminalTitle("OpenTUI React under Node.js")
  }, [renderer])

  useEffect(() => {
    if (paused) return
    const interval = setInterval(() => {
      const spawn = []
      const tickEvents = []
      const spawnRipples = []

      setShapes((current) =>
        current.map((shape) => {
          if (dragRef.current?.id === shape.id) return shape

          const isDvd = shape.kind === "dvd"

          let x = shape.x + shape.vx
          let y = shape.y + shape.vy
          let vx = isDvd ? shape.vx : shape.vx * 0.988
          let vy = isDvd ? shape.vy : shape.vy * 0.988 + Math.sin((shape.index + tick) / 18) * 0.006
          const bounds = boundsFor(shape, width, height)
          const bouncedX = x <= 0 || x >= bounds.maxX
          const bouncedY = y <= 1 || y >= bounds.maxY

          if (bouncedX) {
            x = clamp(x, 0, bounds.maxX)
            vx = isDvd ? -vx : -vx * 0.78
          }
          if (bouncedY) {
            y = clamp(y, 1, bounds.maxY)
            vy = isDvd ? -vy : -vy * 0.78
          }

          if (isDvd) {
            const minSpeed = 0.55
            const speed = Math.hypot(vx, vy)
            if (speed < minSpeed) {
              const angle = speed < 1e-4 ? Math.random() * Math.PI * 2 : Math.atan2(vy, vx)
              vx = Math.cos(angle) * minSpeed
              vy = Math.sin(angle) * minSpeed * 0.65
            }
          } else {
            if (Math.abs(vx) < 0.018) vx = Math.sin((tick + shape.index) / 13) * 0.035
            if (Math.abs(vy) < 0.018) vy = Math.cos((tick + shape.index) / 15) * 0.03
          }

          const bounced = bouncedX || bouncedY
          const colorIndex = bounced ? ((shape.colorIndex ?? 0) + 1) % dragPalette.length : shape.colorIndex
          const color = shape.kind === "dvd" && bounced ? dragPalette[colorIndex ?? 0] : shape.color

          if (bounced) {
            const cx = x + shape.width / 2
            const cy = y + shape.height / 2
            const count = 6 + Math.floor(Math.random() * 5)
            for (let k = 0; k < count; k++) {
              spawn.push(
                makeParticle(cx, cy, {
                  color: Math.random() < 0.4 ? dragPalette[colorIndex % dragPalette.length] : shape.color,
                  speed: 0.6 + Math.random() * 1.6,
                  maxLife: 18 + Math.floor(Math.random() * 14),
                }),
              )
            }
            spawnRipples.push({
              id: nextRippleId++,
              cx: Math.round(cx),
              cy: Math.round(cy),
              age: 0,
              maxAge: 22,
              color: shape.color,
            })
            tickEvents.push({
              text: `${shape.label} bounce`,
              color: shape.color,
            })
          }

          return { ...shape, x, y, vx, vy, colorIndex, color }
        }),
      )

      setParticles((current) => {
        const moved = []
        for (const p of current) {
          const nx = p.x + p.vx
          const ny = p.y + p.vy
          const nextLife = p.life + 1
          if (nextLife >= p.maxLife) continue
          if (nx < -1 || ny < -1 || nx > width + 1 || ny > height + 1) continue
          moved.push({
            ...p,
            x: nx,
            y: ny,
            vx: p.vx * 0.94,
            vy: p.vy * 0.94 + 0.03,
            life: nextLife,
          })
        }
        if (spawn.length === 0) return moved
        return [...moved, ...spawn].slice(-MAX_PARTICLES)
      })

      setRipples((current) => {
        const aged = []
        for (const r of current) {
          const nextAge = r.age + 1
          if (nextAge >= r.maxAge) continue
          aged.push({ ...r, age: nextAge })
        }
        if (spawnRipples.length === 0) return aged
        return [...aged, ...spawnRipples].slice(-MAX_RIPPLES)
      })

      if (tickEvents.length > 0) {
        setEvents((current) =>
          [
            ...tickEvents.map((ev) => ({
              id: nextEventId++,
              text: `[${(tick + 1).toString().padStart(4, "0")}] ${ev.text}`,
              color: ev.color,
            })),
            ...current,
          ].slice(0, MAX_EVENTS),
        )
      }

      setBars((current) =>
        current.map((v, i) => {
          const drift = Math.sin((tick + i * 7) / 6) * 0.18
          const noise = Math.random() * 0.35
          const next = v * 0.78 + (drift + noise) * 0.4
          return clamp(next + (Math.random() < 0.05 ? 0.45 : 0), 0.05, 1)
        }),
      )

      const mp = mouseRef.current
      if (mp.x >= 0 && mp.y >= 0) {
        setTrail((current) => {
          const head = current[0]
          if (head && head.x === mp.x && head.y === mp.y) return current
          return [{ x: mp.x, y: mp.y, t: tick + 1 }, ...current].slice(0, MAX_TRAIL)
        })
      } else if (trail.length > 0) {
        setTrail((current) => current.slice(0, -1))
      }

      fpsRef.current.frames++
      const now = Date.now()
      const elapsed = now - fpsRef.current.lastTime
      if (elapsed >= 500) {
        const measured = (fpsRef.current.frames * 1000) / elapsed
        setFps(measured)
        fpsRef.current.frames = 0
        fpsRef.current.lastTime = now
      }

      setTick((t) => t + 1)
    }, 33)
    return () => clearInterval(interval)
  }, [paused, height, renderer, width, tick, trail.length])

  useEffect(() => {
    if (!Number.isFinite(duration) || duration <= 0) return
    const timeout = setTimeout(() => renderer.destroy(), duration * 1000)
    return () => clearTimeout(timeout)
  }, [duration, renderer])

  useEffect(() => {
    setShapes((current) =>
      current.map((shape) => {
        const bounds = boundsFor(shape, width, height)
        return {
          ...shape,
          x: clamp(shape.x, 0, bounds.maxX),
          y: clamp(shape.y, 1, bounds.maxY),
        }
      }),
    )
  }, [height, width])

  const beginDrag = (shape, event) => {
    event.stopPropagation()
    event.preventDefault()
    const now = Date.now()
    dragRef.current = {
      id: shape.id,
      offsetX: event.x - shape.x,
      offsetY: event.y - shape.y,
      lastX: event.x,
      lastY: event.y,
      lastAt: now,
      moved: false,
      startedAt: now,
    }
    setActiveId(shape.id)
    renderer.setMousePointer("move")
    const cx = shape.x + shape.width / 2
    const cy = shape.y + shape.height / 2
    setParticles((current) => {
      const ring = []
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2
        ring.push(
          makeParticle(cx, cy, {
            angle,
            speed: 0.5 + Math.random() * 0.7,
            color: shape.color,
            maxLife: 20,
          }),
        )
      }
      return [...current, ...ring].slice(-MAX_PARTICLES)
    })
    setRipples((current) =>
      [
        ...current,
        {
          id: nextRippleId++,
          cx: Math.round(cx),
          cy: Math.round(cy),
          age: 0,
          maxAge: 18,
          color: shape.color,
        },
      ].slice(-MAX_RIPPLES),
    )
    setEvents((current) =>
      [
        {
          id: nextEventId++,
          text: `[${tick.toString().padStart(4, "0")}] grabbed ${shape.label}`,
          color: shape.color,
        },
        ...current,
      ].slice(0, MAX_EVENTS),
    )
  }

  const dragShape = (shape, event) => {
    event.stopPropagation()
    const drag = dragRef.current?.id === shape.id ? dragRef.current : null
    if (!drag) return

    const now = Date.now()
    const elapsed = Math.max(16, now - drag.lastAt)
    const vx = ((event.x - drag.lastX) / elapsed) * 28
    const vy = ((event.y - drag.lastY) / elapsed) * 28

    if (event.x !== drag.lastX || event.y !== drag.lastY) drag.moved = true
    drag.lastX = event.x
    drag.lastY = event.y
    drag.lastAt = now

    setShapes((current) =>
      current.map((item) => {
        if (item.id !== shape.id) return item
        const bounds = boundsFor(item, width, height)
        return {
          ...item,
          x: clamp(event.x - drag.offsetX, 0, bounds.maxX),
          y: clamp(event.y - drag.offsetY, 1, bounds.maxY),
          vx: clamp(vx, -1.8, 1.8),
          vy: clamp(vy, -1.4, 1.4),
        }
      }),
    )
  }

  const releaseDrag = (shape, event) => {
    if (event && event.stopPropagation) event.stopPropagation()
    const drag = dragRef.current?.id === shape.id ? dragRef.current : null
    if (!drag) return
    dragRef.current = null
    setActiveId(null)
    renderer.setMousePointer("default")

    const cx = shape.x + shape.width / 2
    const cy = shape.y + shape.height / 2
    const speed = Math.hypot(shape.vx, shape.vy)
    const wasClick = !drag.moved
    const count = wasClick ? 14 : 16 + Math.floor(speed * 9)
    setParticles((current) =>
      [...current, ...burstAt(cx, cy, count, shape.color)].slice(-MAX_PARTICLES),
    )
    setRipples((current) =>
      [
        ...current,
        {
          id: nextRippleId++,
          cx: Math.round(cx),
          cy: Math.round(cy),
          age: 0,
          maxAge: wasClick ? 16 : 24,
          color: shape.color,
        },
      ].slice(-MAX_RIPPLES),
    )
    setEvents((current) =>
      [
        {
          id: nextEventId++,
          text: wasClick
            ? `[${tick.toString().padStart(4, "0")}] poked ${shape.label}`
            : `[${tick.toString().padStart(4, "0")}] flung ${shape.label} (v=${speed.toFixed(2)})`,
          color: shape.color,
        },
        ...current,
      ].slice(0, MAX_EVENTS),
    )
  }

  const handleMouseMove = (event) => {
    mouseRef.current = { x: event.x, y: event.y }
  }

  const handleMouseLeave = () => {
    mouseRef.current = { x: -1, y: -1 }
  }

  const compact = width < 110 || height < 26

  return (
    <box
      width="100%"
      height="100%"
      backgroundColor="#050711"
      position="relative"
      overflow="hidden"
      onMouseMove={handleMouseMove}
      onMouseOut={handleMouseLeave}
    >
      <Ripples ripples={ripples} />

      <box width="100%" height="100%" flexDirection="column" padding={1} gap={1}>
        <box
          border
          borderStyle="heavy"
          borderColor={palette[Math.floor(tick / 5) % palette.length]}
          backgroundColor="#090b1d"
          padding={1}
          flexDirection="column"
          alignItems="center"
        >
          <ascii-font
            selectable={false}
            text={compact ? "REACT" : "OPEN TUI REACT"}
            font="tiny"
            color={["#20f6ff", "#7c5cff", "#ff3df2", "#ffbf3d", "#5dff9b"]}
          />
          <box flexDirection="row" gap={2} alignItems="center">
            <text selectable={false} fg="#dfe5ff" attributes={TextAttributes.BOLD}>
              React components rendering through OpenTUI Core on Node.js
            </text>
            <text selectable={false} fg="#5dff9b" attributes={TextAttributes.DIM}>
              {paused ? "[paused]" : "[live]"}
            </text>
          </box>
        </box>

        <box flexDirection={compact ? "column" : "row"} gap={1} flexGrow={1}>
          <RuntimeCard tick={tick} width={width} height={height} />
          <JsxCard tick={tick} />
          <TelemetryCard
            tick={tick}
            fps={fps}
            particleCount={particles.length}
            events={events}
            paused={paused}
            bars={bars}
          />
        </box>

        <box height={1} flexDirection="row" justifyContent="space-between">
          <text selectable={false} fg="#8490bb" attributes={TextAttributes.DIM}>
            drag shapes · space=pause · r=scatter · c=clear · ?=help · q/esc=quit
          </text>
          <text selectable={false} fg={palette[Math.floor(tick / 3) % palette.length]} attributes={TextAttributes.BOLD}>
            {`frame ${tick.toString().padStart(4, "0")}`}
          </text>
        </box>
      </box>

      {shapes.map((shape) => (
        <ShapeTrail key={`${shape.id}-trail`} shape={shape} tick={tick} />
      ))}

      <ParticleField particles={particles} />

      {shapes.map((shape, index) => {
        const enriched = { ...shape, index }
        return (
          <FloatingShape
            key={shape.id}
            shape={enriched}
            tick={tick}
            active={activeId === shape.id}
            onMouseDown={(event) => beginDrag(enriched, event)}
            onMouseDrag={(event) => dragShape(enriched, event)}
            onMouseDragEnd={(event) => releaseDrag(enriched, event)}
            onMouseUp={(event) => releaseDrag(enriched, event)}
            onMouseOver={() => renderer.setMousePointer("move")}
            onMouseOut={() => {
              if (!dragRef.current) renderer.setMousePointer("default")
            }}
          />
        )
      })}

      <MouseCursor trail={trail} current={mouseRef.current} tick={tick} />

      {showHelp && <HelpOverlay tick={tick} />}
    </box>
  )
}

const renderer = await createCliRenderer({
  targetFps: 30,
  maxFps: 30,
  backgroundColor: "#050711",
  consoleMode: "disabled",
  exitOnCtrlC: true,
  useMouse: true,
  enableMouseMovement: true,
})

const root = createRoot(renderer)
root.render(<App duration={parseDuration(process.argv)} />)
