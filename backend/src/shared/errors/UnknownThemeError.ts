export class UnknownThemeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownThemeError';
  }
}
