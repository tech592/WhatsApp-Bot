import { google } from 'googleapis';
import { GOOGLE_SHEETS_SERVICE_ACCOUNT } from '../config/secrets';

export class SheetsService {
  private static async getClient() {
    const serviceAccountJson = GOOGLE_SHEETS_SERVICE_ACCOUNT.value();
    const credentials = JSON.parse(serviceAccountJson);
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    return google.sheets({ version: 'v4', auth });
  }

  /**
   * Fetches data from a specific sheet and attempts to find a row matching the given name and date.
   * Note: Assumes a standard structure where row data is returned as strings.
   * You may need to adjust the range depending on the exact sheet structure.
   */
  static async findUserRowForDate(sheetId: string, sheetName: string, fullName: string, dateStr: string): Promise<string | null> {
    const sheets = await this.getClient();
    
    // Assuming data is in A:Z range
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }

    // Attempt to find a row that contains both the user's name and the specific date string
    // This is a naive search, assuming name and date are somewhere in the row.
    const matchingRow = rows.find(row => {
      const rowString = row.join(' ').toLowerCase();
      return rowString.includes(fullName.toLowerCase()) && rowString.includes(dateStr.toLowerCase());
    });

    if (matchingRow) {
      return matchingRow.join(' | '); // Convert row data to a string for Gemini to analyze
    }

    return null;
  }
}
