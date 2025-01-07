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
}