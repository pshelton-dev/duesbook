// Turn a luminance mask (white shape on black) into a solid-colour PNG whose
// alpha channel is the mask. QuickLook flattens SVG transparency onto white,
// so transparent assets are produced this way instead.
//
//   swift design/mask-to-alpha.swift mask.png '#2e7d46' out.png
import Foundation
import CoreGraphics
import ImageIO

let args = CommandLine.arguments
guard args.count == 4 else {
  FileHandle.standardError.write("usage: mask-to-alpha.swift <mask.png> <#rrggbb> <out.png>\n".data(using: .utf8)!)
  exit(2)
}
let hex = UInt32(args[2].trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16)!
let (r, g, b) = (UInt8(hex >> 16 & 0xff), UInt8(hex >> 8 & 0xff), UInt8(hex & 0xff))

let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil)!
let img = CGImageSourceCreateImageAtIndex(src, 0, nil)!
let w = img.width, h = img.height
let space = CGColorSpaceCreateDeviceRGB()
let inCtx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                      space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
inCtx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
let p = inCtx.data!.assumingMemoryBound(to: UInt8.self)

var out = [UInt8](repeating: 0, count: w * h * 4)
for i in stride(from: 0, to: w * h * 4, by: 4) {
  let a = UInt32(p[i]) // red channel of a grey mask == luminance
  out[i] = UInt8(UInt32(r) * a / 255)
  out[i + 1] = UInt8(UInt32(g) * a / 255)
  out[i + 2] = UInt8(UInt32(b) * a / 255)
  out[i + 3] = UInt8(a)
}
let outCtx = out.withUnsafeMutableBytes { buf in
  CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
            space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
}
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[3]) as CFURL, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(dest, outCtx.makeImage()!, nil)
guard CGImageDestinationFinalize(dest) else { exit(1) }
print("wrote \(args[3]) \(w)x\(h)")
