export interface PageLayout {
  pageSize: 'letter' | 'a4' | 'a5' | 'kdp-5x8' | 'kdp-5.5x8.5' | 'kdp-6x9';
  width: number;
  height: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}
