import {
  BorderCharArrays,
  RGBA,
  TextAttributes,
  VRenderable,
  createCliRenderer,
  createTextAttributes,
  parseColor,
} from "@jitl/opentui-core"

const colorCache = new Map()
const color = (hex) => {
  let cached = colorCache.get(hex)
  if (!cached) {
    cached = parseColor(hex)
    colorCache.set(hex, cached)
  }
  return cached
}

const transparent = RGBA.fromValues(0, 0, 0, 0)
const bold = createTextAttributes({ bold: true })
const dim = createTextAttributes({ dim: true })
const boldUnderline = createTextAttributes({ bold: true, underline: true })

const logo = [
  "  ____                  _______ _    _ _____ ",
  " / __ \\                |__   __| |  | |_   _|",
  "| |  | |_ __   ___ _ __   | |  | |  | | | |  ",
  "| |  | | '_ \\ / _ \\ '_ \\  | |  | |  | | | |  ",
  "| |__| | |_) |  __/ | | | | |  | |__| |_| |_ ",
  " \\____/| .__/ \\___|_| |_| |_|   \\____/|_____|",
  "       | |                                  ",
  "       |_|                                  ",
]

const compactLogo = [
  "  ___                 _______ _   _ ___ ",
  " / _ \\ _ __  ___ _ _|_   _| | | | |_ _|",
  "| (_) | '_ \\/ -_) ' \\ | | | |_| | || | ",
  " \\___/| .__/\\___|_||_||_|  \\___/|___|",
  "      |_|                              ",
]

const packets = ["JS", "UI", "ZIG", "GPU", "TTY", "FPS", "RGB", "LAYOUT"]
const palette = [
  "#20f6ff",
  "#7c5cff",
  "#ff3df2",
  "#ffbf3d",
  "#5dff9b",
  "#ffffff",
]

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const mix = (a, b, t) => Math.round(a + (b - a) * t)
const sin01 = (value) => (Math.sin(value) + 1) / 2

function gradient(from, to, t) {
  const a = color(from).toInts()
  const b = color(to).toInts()
  return RGBA.fromInts(mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t), 255)
}

function drawTextSafe(buffer, text, x, y, fg, bg, attr) {
  if (y < 0 || x >= buffer.width || y >= buffer.height) return
  const start = Math.max(0, x)
  const visible = text.slice(start - x, Math.max(0, buffer.width - x))
  if (visible.length > 0) {
    buffer.drawText(visible, start, y, fg, bg, attr)
  }
}

function drawCentered(buffer, text, y, fg, bg, attr) {
  drawTextSafe(buffer, text, Math.floor((buffer.width - text.length) / 2), y, fg, bg, attr)
}

function drawBar(buffer, x, y, width, label, value, fg) {
  const barWidth = Math.max(4, width - label.length - 4)
  const filled = clamp(Math.round(barWidth * value), 0, barWidth)
  drawTextSafe(buffer, label, x, y, color("#9aa6c8"), transparent, dim)
  buffer.drawText("[" + "#".repeat(filled) + "-".repeat(barWidth - filled) + "]", x + label.length + 1, y, fg)
}

function drawPanel(buffer, x, y, width, height, title, accent, t) {
  if (width < 12 || height < 4) return
  const borderColor = gradient(accent, "#ffffff", 0.2 + sin01(t * 3) * 0.25)
  buffer.drawBox({
    x,
    y,
    width,
    height,
    borderStyle: "rounded",
    border: true,
    borderColor,
    backgroundColor: color("#080b18"),
    title: ` ${title} `,
    titleAlignment: "center",
    bottomTitle: " live ",
    bottomTitleAlignment: "right",
  })
}

function drawStarfield(buffer, w, h, t) {
  buffer.clear(color("#050711"))

  for (let y = 0; y < h; y++) {
    const blend = y / Math.max(1, h - 1)
    buffer.fillRect(0, y, w, 1, gradient("#050711", "#11102a", blend * 0.65))
  }

  const starCount = clamp(Math.floor((w * h) / 20), 40, 220)
  for (let i = 0; i < starCount; i++) {
    const baseX = (i * 37 + i * i * 11) % Math.max(1, w)
    const baseY = (i * 19 + i * i * 7) % Math.max(1, h)
    const drift = Math.floor(t * (3 + (i % 5)))
    const x = (baseX + drift) % w
    const y = (baseY + Math.floor(drift / 4)) % h
    const twinkle = sin01(t * 4 + i * 0.73)
    const ch = twinkle > 0.86 ? "*" : twinkle > 0.55 ? "+" : "."
    const fg = twinkle > 0.7 ? color("#d8fbff") : color("#33446e")
    buffer.drawText(ch, x, y, fg)
  }

  for (let lane = -h; lane < w; lane += 14) {
    const offset = Math.floor(t * 18) % 14
    for (let step = 0; step < h; step++) {
      const x = lane + step + offset
      const y = step
      if (x >= 0 && x < w && y >= 0 && y < h && step % 3 === 0) {
        buffer.drawText("/", x, y, color("#123d55"))
      }
    }
  }
}

function drawLogo(buffer, t) {
  const lines = buffer.width >= 86 ? logo : compactLogo
  const logoWidth = Math.max(...lines.map((line) => line.length))
  const x = Math.max(1, Math.floor((buffer.width - logoWidth) / 2))
  const y = buffer.height < 24 ? 2 : 3
  const boxPadX = 3
  const boxPadY = 1

  buffer.drawBox({
    x: Math.max(0, x - boxPadX),
    y: Math.max(0, y - boxPadY),
    width: Math.min(buffer.width, logoWidth + boxPadX * 2),
    height: lines.length + boxPadY * 2,
    borderStyle: "heavy",
    border: true,
    borderColor: gradient("#20f6ff", "#ff3df2", sin01(t * 2.6)),
    backgroundColor: color("#090b1d"),
    title: " OPEN TERMINAL UI ",
    titleAlignment: "center",
  })

  for (let row = 0; row < lines.length; row++) {
    const fg = gradient(palette[row % palette.length], palette[(row + 2) % palette.length], sin01(t * 2 + row))
    drawTextSafe(buffer, lines[row], x, y + row, fg, transparent, bold)
  }

  const sub = "NATIVE ZIG CORE  <->  JAVASCRIPT OBJECTS  <->  NODE.JS"
  const shine = " ".repeat(Math.floor(sin01(t * 2.2) * 8)) + "<<< LIVE >>>"
  drawCentered(buffer, sub, y + lines.length + 2, color("#d5dcff"), transparent, bold)
  drawCentered(buffer, shine, y + lines.length + 3, gradient("#5dff9b", "#20f6ff", sin01(t * 4)), transparent, boldUnderline)
}

function drawPipeline(buffer, x, y, width, t) {
  const stages = ["NODE", "RENDERABLES", "LAYOUT", "ZIG BUFFER", "TERMINAL"]
  const inner = width - 4
  if (inner < 32) return
  const gap = Math.max(1, Math.floor((inner - stages.join("").length) / (stages.length - 1)))
  let cursor = x + 2

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const fg = gradient(palette[i % palette.length], "#ffffff", sin01(t * 3 + i))
    buffer.drawText(stage, cursor, y, fg, transparent, bold)
    if (i < stages.length - 1) {
      const arrowX = cursor + stage.length + 1
      const arrowWidth = Math.max(2, gap - 2)
      buffer.drawText("-".repeat(arrowWidth) + ">", arrowX, y, color("#415276"))
    }
    cursor += stage.length + gap
  }

  const packetTrack = Math.max(1, width - 8)
  for (let i = 0; i < packets.length; i++) {
    const px = x + 4 + Math.floor(((t * (7 + i) + i * 13) % packetTrack))
    const py = y + 2 + (i % 3)
    drawTextSafe(buffer, packets[i], px, py, color(palette[i % palette.length]), color("#11152d"), bold)
  }
}

function drawSignalPanel(buffer, x, y, width, height, t) {
  drawPanel(buffer, x, y, width, height, "FRAMEBUFFER SIGNAL", "#20f6ff", t)
  const left = x + 2
  const right = x + width - 3
  const midY = y + Math.floor(height / 2)

  for (let px = left; px <= right; px++) {
    const wave = Math.sin((px - left) * 0.28 + t * 4.2)
    const wave2 = Math.sin((px - left) * 0.11 - t * 2.4)
    const py = midY + Math.round((wave + wave2 * 0.55) * Math.max(1, (height - 6) / 4))
    if (py > y && py < y + height - 1) {
      buffer.drawText("*", px, py, gradient("#20f6ff", "#ff3df2", (px - left) / Math.max(1, right - left)))
    }
  }

  for (let i = 0; i < 5; i++) {
    drawBar(
      buffer,
      left,
      y + height - 7 + i,
      width - 4,
      ["draw", "diff", "layout", "color", "node"][i].padEnd(6),
      sin01(t * (1.2 + i * 0.23) + i),
      color(palette[i % palette.length]),
    )
  }
}

function drawRuntimePanel(buffer, x, y, width, height, t, startTime) {
  drawPanel(buffer, x, y, width, height, "NODE.JS RUNTIME", "#ffbf3d", t + 1)
  const now = Date.now()
  const uptime = ((now - startTime) / 1000).toFixed(1).padStart(5)
  const rows = [
    ["process", process.version],
    ["package", "@jitl/opentui-core"],
    ["target", "30 FPS animation"],
    ["screen", `${buffer.width} x ${buffer.height} cells`],
    ["uptime", `${uptime}s`],
  ]

  for (let i = 0; i < rows.length && i < height - 5; i++) {
    const [label, value] = rows[i]
    drawTextSafe(buffer, label.padEnd(8), x + 2, y + 2 + i, color("#7f8bb4"), transparent, dim)
    drawTextSafe(buffer, value.slice(0, Math.max(0, width - 13)), x + 11, y + 2 + i, color("#f5f7ff"), transparent, i === 0 ? bold : TextAttributes.NONE)
  }

  const spinner = "|/-\\"[Math.floor(t * 12) % 4]
  drawTextSafe(buffer, `${spinner} JS driving native terminal pixels`, x + 2, y + height - 3, color("#5dff9b"), transparent, bold)
}

function drawFooter(buffer, t) {
  const y = buffer.height - 2
  if (y < 0) return
  const message = "   OpenTUI Core running under Node.js from ./index.js   "
  const repeated = message.repeat(Math.ceil(buffer.width / message.length) + 2)
  const offset = Math.floor(t * 18) % message.length
  buffer.fillRect(0, y - 1, buffer.width, 3, color("#080a16"))
  buffer.drawGrid({
    borderChars: BorderCharArrays.single,
    borderFg: color("#253050"),
    borderBg: color("#080a16"),
    columnOffsets: new Int32Array([0, buffer.width - 1]),
    rowOffsets: new Int32Array([y - 1, buffer.height - 1]),
    drawInner: false,
    drawOuter: true,
  })
  drawTextSafe(buffer, repeated.slice(offset, offset + buffer.width), 0, y, gradient("#20f6ff", "#ff3df2", sin01(t * 2)), transparent, bold)
}

function parseDuration(argv) {
  const durationArg = argv.find((arg) => arg.startsWith("--duration="))
  if (durationArg) return Number(durationArg.split("=")[1])
  const index = argv.indexOf("--duration")
  if (index !== -1) return Number(argv[index + 1])
  return null
}

const renderer = await createCliRenderer({
  targetFps: 30,
  maxFps: 30,
  backgroundColor: "#050711",
  exitOnCtrlC: true,
  consoleMode: "disabled",
})

renderer.setTerminalTitle("OpenTUI Core under Node.js")

const startTime = Date.now()
let shuttingDown = false

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  renderer.dropLive()
  renderer.destroy()
}

const scene = new VRenderable(renderer, {
  id: "opentui-node-demo",
  width: "100%",
  height: "100%",
  live: true,
  render(buffer, _deltaTime, renderable) {
    const t = (Date.now() - startTime) / 1000
    const width = renderable.width
    const height = renderable.height

    drawStarfield(buffer, width, height, t)
    drawLogo(buffer, t)

    const panelsTop = height < 25 ? 13 : 16
    const panelHeight = Math.max(8, height - panelsTop - 4)
    if (height >= 20 && width >= 72) {
      const gap = 2
      const leftWidth = Math.max(32, Math.floor((width - gap - 4) * 0.6))
      const rightWidth = Math.max(26, width - leftWidth - gap - 4)
      const leftX = 2
      const rightX = leftX + leftWidth + gap

      drawSignalPanel(buffer, leftX, panelsTop, leftWidth, panelHeight, t)
      drawRuntimePanel(buffer, rightX, panelsTop, rightWidth, panelHeight, t, startTime)
      if (panelHeight >= 12) {
        drawPipeline(buffer, leftX, panelsTop + 2, leftWidth, t)
      }
    } else {
      drawCentered(buffer, `${process.version} + @jitl/opentui-core`, height - 5, color("#f5f7ff"), transparent, bold)
      drawCentered(buffer, "resize taller for the full cockpit", height - 4, color("#7f8bb4"), transparent, dim)
    }

    drawFooter(buffer, t)
  },
})

renderer.root.add(scene)
renderer.addInputHandler((sequence) => {
  if (sequence === "q" || sequence === "Q") {
    shutdown()
    return true
  }
  return false
})

renderer.setFrameCallback(async () => {
  scene.requestRender()
})

renderer.requestLive()
renderer.start()

const duration = parseDuration(process.argv)
if (Number.isFinite(duration) && duration > 0) {
  setTimeout(shutdown, duration * 1000)
}
