import Dicer from 'dicer';
import { Writable } from 'stream';
import { PartData } from "./interfaces";

export class Utils {
    static sanitizeFileName(fileName: string): string {
        // Replace illegal characters with an underscore or a safe character
        return fileName
            .replace(/[<>:"/\\|?*]/g, '')  // Replace illegal characters on Windows
            .replace(/[\x00-\x1F\x80-\x9F]/g, '')  // Remove control characters
            .replace(/^\.+$/, '')  // Avoid names like "." or ".."
            .replace(/^\s+|\s+$/g, '')  // Trim leading/trailing spaces
            .replace(/[\s.]+$/, '')  // Remove trailing spaces or periods
            .substring(0, 255);  // Limit filename length
    }

    static async parseMultipart(articleData: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const contentType = articleData.headers['content-type'];

            const RE_BOUNDARY = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i;
            const m: any = RE_BOUNDARY.exec(contentType);
            const dicer = new Dicer({ boundary: m[1] || m[2] });
            const parts: PartData[] = [];

            dicer.on('part', (part) => {
                const partData: PartData = {
                    bookmarkId: '',
                    contentDisposition: {},
                    contentType: {},
                };

                part.on('header', (headers: any) => {
                    partData.bookmarkId = headers['bookmark-id'];
                    partData.contentDisposition.base = headers['content-disposition']?.[0].split(";")[0];
                    partData.contentDisposition.filename = headers['content-disposition']?.toString().match(/filename="(.+?)"/)?.[1];
                    partData.contentType.base = headers['content-type']?.[0].split(";")[0];
                    partData.contentType.charset = headers['content-type']?.toString().match(/charset=(.[^;]*)/)?.[1];
                });

                part.on('data', (data) => {
                    partData.body = data;
                });
                part.on('end', () => {
                    parts.push(partData);
                });
            });
            dicer.on('finish', () => {
                resolve(parts);
            });
            dicer.on('error', (err) => {
                console.error("Dicer error:", err);
                reject(err);
            });

            const writable = new Writable({
                write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
                    dicer.write(chunk, encoding, callback);
                },
            });

            writable.end(Buffer.from(articleData.arrayBuffer));
        });
    }

    static updateImagePaths(text: string, oldPath: string, newPath: string) {
        const imageRegex = /!\[.*?\]\(\.\/(.*?\.(?:png|jpg|jpeg|gif|svg|webp))\)/g;

        const updatedtext = text.replace(imageRegex, (match, imageId) => {
            return match.replace(`${oldPath}${imageId}`, `${newPath}${imageId}`);
        });

        return updatedtext;
    }
}