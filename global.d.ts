declare module "gifenc" {
  export function GIFEncoder(opts?: any): any;
  export function quantize(rgba: Uint8Array, maxColors: number, opts?: any): any;
  export function applyPalette(rgba: Uint8Array, palette: any, format?: string): any;
}

declare module "pngjs" {
  export class PNG {
    static sync: {
      read(buffer: Buffer): {
        width: number;
        height: number;
        data: Buffer;
      };
      write(png: any): Buffer;
    };
  }
}

declare module "pureimage" {
  export function make(width: number, height: number): any;
  export function registerFont(path: string, family: string, weight?: number, style?: string): any;
  export function encodePNGToStream(canvas: any, stream: any): Promise<void>;
  export function decodePNGFromStream(stream: any): Promise<any>;
  export function decodeJPEGFromStream(stream: any): Promise<any>;
}
