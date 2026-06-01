export function generateTicketNumber(year: number, sequence: number): string {
  return `IT-${year}-${String(sequence).padStart(4, "0")}`;
}
