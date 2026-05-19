/** @jsxImportSource @jitl/opentui-react */

import { createCliRenderer, TextAttributes } from "@jitl/opentui-core"
import { createRoot, useKeyboard, useRenderer, useTerminalDimensions } from "@jitl/opentui-react"
import React from "react"
import { useEffect, useMemo, useRef, useState } from "react"

const palette = ["#20f6ff", "#7c5cff", "#ff3df2", "#ffbf3d", "#5dff9b"]
const dragPalette = ["#20f6ff", "#ff3df2", "#ffbf3d", "#5dff9b", "#7c5cff", "#ff6b6b", "#8cfffb"]

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
      colorIndex: dragPalette.indexOf(seeded.color),
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

function ColorMixLayer({ tick, compact }) {
  const sweepX = compact ? 4 + (tick % 28) : 8 + (tick % 54)
  const pads = [
    { left: compact ? 4 : 12, top: compact ? 5 : 8, width: 24, height: 8, color: "#20f6ff", label: "cyan", opacity: 0.34 },
    { left: compact ? 16 : 29, top: compact ? 8 : 11, width: 25, height: 8, color: "#ff3df2", label: "magenta", opacity: 0.32 },
    { left: compact ? 10 : 48, top: compact ? 12 : 15, width: 28, height: 7, color: "#ffbf3d", label: "amber", opacity: 0.26 },
    { left: compact ? 23 : 72, top: compact ? 6 : 10, width: 24, height: 9, color: "#5dff9b", label: "green", opacity: 0.25 },
  ]

  return (
    <>
      {pads.map((pad, index) => (
        <box
          key={pad.label}
          position="absolute"
          left={pad.left}
          top={pad.top}
          width={pad.width}
          height={pad.height}
          zIndex={8 + index}
          opacity={pad.opacity + Math.sin(tick / 18 + index) * 0.05}
          backgroundColor={pad.color}
          border
          borderStyle="rounded"
          borderColor={pad.color}
          alignItems="center"
          justifyContent="center"
        >
          <text selectable={false} fg="#050711" attributes={TextAttributes.BOLD}>
            {pad.label}
          </text>
        </box>
      ))}

      <box
        position="absolute"
        left={sweepX}
        top={compact ? 3 : 4}
        width={compact ? 26 : 42}
        height={1}
        zIndex={18}
        opacity={0.42}
        backgroundColor={dragPalette[Math.floor(tick / 8) % dragPalette.length]}
      />
      <box
        position="absolute"
        left={Math.max(1, sweepX - 6)}
        top={compact ? 4 : 5}
        width={compact ? 18 : 28}
        height={1}
        zIndex={17}
        opacity={0.18}
        backgroundColor="#ffffff"
      />
    </>
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

function FloatingShape({ shape, tick, active, onMouseDown, onMouseDrag, onMouseDragEnd, onMouseOver, onMouseOut }) {
  const lines = shapeLines(shape, tick, active)

  return (
    <box
      position="absolute"
      left={Math.round(shape.x)}
      top={Math.round(shape.y)}
      width={shape.width}
      height={shape.height}
      zIndex={active ? 80 : 40 + shape.index}
      opacity={active ? 1 : 0.88}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      backgroundColor={active ? "#11172d" : "transparent"}
      border={active || shape.kind === "capsule" || shape.kind === "frame" || shape.kind === "dvd"}
      borderStyle={active ? "double" : "rounded"}
      borderColor={shape.color}
      focusable
      onMouseDown={onMouseDown}
      onMouseDrag={onMouseDrag}
      onMouseDragEnd={onMouseDragEnd}
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

function App({ duration }) {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const [tick, setTick] = useState(0)
  const [activeId, setActiveId] = useState(null)
  const [shapes, setShapes] = useState(() => seedShapes(width, height))
  const dragRef = useRef(null)

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape" || (key.ctrl && key.name === "c")) {
      renderer.destroy()
    }
  })

  useEffect(() => {
    renderer.setTerminalTitle("OpenTUI React under Node.js")
    const interval = setInterval(() => {
      setTick((value) => {
        const nextTick = value + 1
        setShapes((current) =>
          current.map((shape) => {
            if (dragRef.current?.id === shape.id) return shape

            let x = shape.x + shape.vx
            let y = shape.y + shape.vy
            let vx = shape.vx * 0.988
            let vy = shape.vy * 0.988 + Math.sin((shape.index + nextTick) / 18) * 0.006
            const bounds = boundsFor(shape, width, height)
            const bouncedX = x <= 0 || x >= bounds.maxX
            const bouncedY = y <= 1 || y >= bounds.maxY

            if (bouncedX) {
              x = clamp(x, 0, bounds.maxX)
              vx = -vx * 0.78
            }
            if (bouncedY) {
              y = clamp(y, 1, bounds.maxY)
              vy = -vy * 0.78
            }

            if (Math.abs(vx) < 0.018) vx = Math.sin((nextTick + shape.index) / 13) * 0.035
            if (Math.abs(vy) < 0.018) vy = Math.cos((nextTick + shape.index) / 15) * 0.03

            const colorIndex = shape.kind === "dvd" && (bouncedX || bouncedY) ? ((shape.colorIndex ?? 0) + 1) % dragPalette.length : shape.colorIndex

            return {
              ...shape,
              x,
              y,
              vx,
              vy,
              colorIndex,
              color: shape.kind === "dvd" ? dragPalette[colorIndex ?? 0] : shape.color,
            }
          }),
        )
        return nextTick
      })
    }, 33)
    return () => clearInterval(interval)
  }, [height, renderer, width])

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
    }
    setActiveId(shape.id)
    renderer.setMousePointer("move")
  }

  const dragShape = (shape, event) => {
    event.stopPropagation()
    const drag = dragRef.current?.id === shape.id ? dragRef.current : null
    if (!drag) return

    const now = Date.now()
    const elapsed = Math.max(16, now - drag.lastAt)
    const vx = ((event.x - drag.lastX) / elapsed) * 28
    const vy = ((event.y - drag.lastY) / elapsed) * 28

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

  const endDrag = (shape, event) => {
    event.stopPropagation()
    if (dragRef.current?.id === shape.id) dragRef.current = null
    setActiveId(null)
    renderer.setMousePointer("default")
  }

  const compact = width < 78 || height < 22

  return (
    <box width="100%" height="100%" backgroundColor="#050711" position="relative" overflow="hidden">
      <ColorMixLayer tick={tick} compact={compact} />

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
          <text selectable={false} fg="#dfe5ff" attributes={TextAttributes.BOLD}>
            React components rendering through OpenTUI Core on Node.js
          </text>
        </box>

        <box flexDirection={compact ? "column" : "row"} gap={1} flexGrow={1}>
          <RuntimeCard tick={tick} width={width} height={height} />
          <JsxCard tick={tick} />
        </box>

        <box height={1} flexDirection="row" justifyContent="space-between">
          <text selectable={false} fg="#8490bb" attributes={TextAttributes.DIM}>
            Drag the floating shapes; release to fling. Press q or Esc to quit
          </text>
          <text selectable={false} fg={palette[Math.floor(tick / 3) % palette.length]} attributes={TextAttributes.BOLD}>
            {`frame ${tick.toString().padStart(4, "0")}`}
          </text>
        </box>
      </box>

      {shapes.map((shape) => (
        <ShapeTrail key={`${shape.id}-trail`} shape={shape} tick={tick} />
      ))}

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
            onMouseDragEnd={(event) => endDrag(enriched, event)}
            onMouseOver={() => renderer.setMousePointer("move")}
            onMouseOut={() => {
              if (!dragRef.current) renderer.setMousePointer("default")
            }}
          />
        )
      })}
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
