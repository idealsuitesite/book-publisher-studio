import { UploadDropzone } from '@/components/UploadDropzone';

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 bg-zinc-50 px-6 py-24 dark:bg-black">
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Book Publisher Studio
      </h1>
      <UploadDropzone />
    </div>
  );
}
