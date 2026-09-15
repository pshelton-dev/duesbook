// Flatten a rasterised icon onto opaque white and write a PNG with no alpha.
//
// App Store Connect rejects an app icon that carries an alpha channel, even a
// fully opaque one, and QuickLook always produces RGBA. sips can convert
// formats but cannot drop the channel, so this composites explicitly.
import AppKit

let args = CommandLine.arguments
guard args.count == 3,
      let src = NSImage(contentsOfFile: args[1]),
      let srcCG = src.cgImage(forProposedRect: nil, context: nil, hints: nil)
else { fputs("usage: flatten-icon <in.png> <out.png>\n", stderr); exit(1) }

let side = srcCG.width
guard let ctx = CGContext(
    data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(),
    // noneSkipLast: three colour channels, the fourth byte ignored — an image
    // with no alpha channel at all rather than one that is merely opaque.
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
else { fputs("could not create context\n", stderr); exit(1) }

ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: side, height: side))
ctx.draw(srcCG, in: CGRect(x: 0, y: 0, width: side, height: side))

guard let out = ctx.makeImage(),
      let dest = CGImageDestinationCreateWithURL(
        URL(fileURLWithPath: args[2]) as CFURL, "public.png" as CFString, 1, nil)
else { fputs("could not encode\n", stderr); exit(1) }
CGImageDestinationAddImage(dest, out, nil)
guard CGImageDestinationFinalize(dest) else { fputs("write failed\n", stderr); exit(1) }
print("wrote \(args[2]) \(side)x\(side)")
