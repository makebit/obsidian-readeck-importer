import { MultipartPart, parseMultipart } from '@mjackson/multipart-parser';

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
        return new Promise(async (resolve, reject) => {
            try {
                // Get the content type and boundary from headers
                const contentType = articleData.headers['content-type'];
                const RE_BOUNDARY = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i;
                const match = RE_BOUNDARY.exec(contentType);
                if (!match) {
                    throw new Error("Invalid multipart content-type");
                }
                const boundary = match[1] || match[2];
                let multipartMessage = Buffer.from(articleData.arrayBuffer);
                const parts: MultipartPart[] = [];

                await parseMultipart(multipartMessage, { boundary }, async (part) => {
                    parts.push(part);
                  });
                
                resolve(parts);
            } catch (error) {
                console.error("Error parsing multipart data:", error);
                reject(error);
            }
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