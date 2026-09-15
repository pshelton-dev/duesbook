// Composes one App Store screenshot: a headline on the brand green, with the
// raw simulator capture sitting below it in a rounded frame.
//
//   swift compose.swift <capture.png> <out.png> <width> <height> "<headline>" "<subline>"
//
// The output is exactly <width> x <height>, opaque, sRGB PNG. The capture
// keeps its aspect ratio, is scaled to the frame width, and runs off the
// bottom edge; App Store screenshots are cropped that way on purpose.
import Foundation
import CoreGraphics
import CoreText
import ImageIO

let a = CommandLine.arguments
guard a.count == 7, let W = Int(a[3]), let H = Int(a[4]) else {
  FileHandle.standardError.write("usage: compose.swift in.png out.png width height headline subline\n".data(using: .utf8)!)
  exit(2)
}
let (inPath, outPath, headline, subline) = (a[1], a[2], a[5], a[6])

func load(_ p: String) -> CGImage {
  let s = CGImageSourceCreateWithURL(URL(fileURLWithPath: p) as CFURL, nil)!
  return CGImageSourceCreateImageAtIndex(s, 0, nil)!
}
func rgb(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
  CGColor(srgbRed: CGFloat(hex >> 16 & 0xff) / 255, green: CGFloat(hex >> 8 & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: alpha)
}

let shot = load(inPath)
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
let w = CGFloat(W), h = CGFloat(H)
let isPad = w / h > 0.7

// Background: brand green gradient, top-left to bottom-right.
let gradient = CGGradient(colorsSpace: space, colors: [rgb(0x379a55), rgb(0x2e7d46)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(gradient, start: CGPoint(x: 0, y: h), end: CGPoint(x: w, y: 0), options: [])

// Text block. Sizes scale with the canvas width so phone and iPad match.
let unit = w / 1284
let margin = 96 * unit
let headSize = (isPad ? 84 : 92) * unit
let subSize = (isPad ? 40 : 44) * unit
func draw(_ text: String, size: CGFloat, weight: String, color: CGColor, top: CGFloat) -> CGFloat {
  let font = CTFontCreateWithName(weight as CFString, size, nil)
  let attrs: [NSAttributedString.Key: Any] = [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): color
  ]
  let str = NSAttributedString(string: text, attributes: attrs)
  let setter = CTFramesetterCreateWithAttributedString(str)
  let box = CGSize(width: w - 2 * margin, height: h)
  let fit = CTFramesetterSuggestFrameSizeWithConstraints(setter, CFRange(location: 0, length: 0), nil, box, nil)
  let rect = CGRect(x: margin, y: h - top - fit.height, width: box.width, height: fit.height)
  let path = CGPath(rect: rect, transform: nil)
  let frame = CTFramesetterCreateFrame(setter, CFRange(location: 0, length: 0), path, nil)
  ctx.textMatrix = .identity
  CTFrameDraw(frame, ctx)
  return fit.height
}
let topPad = (isPad ? 150 : 180) * unit
let headH = draw(headline, size: headSize, weight: ".AppleSystemUIFontBold", color: rgb(0xffffff), top: topPad)
let subH = draw(subline, size: subSize, weight: ".AppleSystemUIFont", color: rgb(0xffffff, 0.85), top: topPad + headH + 24 * unit)

// The capture: scaled to the frame width, rounded, with a soft shadow.
let frameTop = topPad + headH + subH + (isPad ? 90 : 110) * unit
let frameW = w - 2 * margin
let scale = frameW / CGFloat(shot.width)
let frameH = CGFloat(shot.height) * scale
let frameRect = CGRect(x: margin, y: h - frameTop - frameH, width: frameW, height: frameH)
let radius = (isPad ? 56 : 72) * unit
let rounded = CGPath(roundedRect: frameRect, cornerWidth: radius, cornerHeight: radius, transform: nil)

ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -18 * unit), blur: 60 * unit, color: rgb(0x000000, 0.35))
ctx.setFillColor(rgb(0xf4f5f2))
ctx.addPath(rounded)
ctx.fillPath()
ctx.restoreGState()

ctx.saveGState()
ctx.addPath(rounded)
ctx.clip()
ctx.draw(shot, in: frameRect)
ctx.restoreGState()

// Hairline so the frame reads against the green.
ctx.saveGState()
ctx.addPath(rounded)
ctx.setStrokeColor(rgb(0xffffff, 0.25))
ctx.setLineWidth(3 * unit)
ctx.strokePath()
ctx.restoreGState()

let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: outPath) as CFURL, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
guard CGImageDestinationFinalize(dest) else { exit(1) }
print("wrote \(outPath) \(W)x\(H)")
