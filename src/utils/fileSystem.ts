import { shallowRef } from 'vue';

export const useDirectoryPicker = () => {
  const dirHandle = shallowRef<FileSystemDirectoryHandle>();

  const pickDir = async (checkFunc?: (handle: FileSystemDirectoryHandle) => Promise<boolean>) => {
    const handle = await window.showDirectoryPicker({
      id: 'maa-root',
      mode: 'readwrite',
      startIn: 'desktop',
    });
    if (checkFunc && !(await checkFunc(handle))) return;
    dirHandle.value = handle;
  };

  return { dirHandle, pickDir };
};

const checkDirExist = async (rootHandle: FileSystemDirectoryHandle, name: string) => {
  try {
    await rootHandle.getDirectoryHandle(name, { create: false });
    return true;
  } catch {
    return false;
  }
};

export const checkIsMAARoot = async (dirHandle: FileSystemDirectoryHandle) => {
  if (!(await checkDirExist(dirHandle, 'cache'))) return false;
  if (!(await checkDirExist(dirHandle, 'resource'))) return false;
  return true;
};
