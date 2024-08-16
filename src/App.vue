<template>
  <h1 class="text-center">MAA Resource Updater</h1>
  <p class="text-center">
    无需依赖任何第三方软件，纯靠浏览器工作的
    <a href="https://github.com/MaaAssistantArknights/MaaResource" target="_blank">MAA 资源文件</a> 更新器
  </p>
  <p class="text-center">仅支持：Chrome ≥ 86, Edge ≥ 86, Opera ≥ 72</p>
  <p class="text-center">
    GitHub: <a href="https://github.com/arkntools/maa-resource-updater" target="_blank">arkntools/maa-resource-updater</a>
  </p>
  <p>Tips 首次使用：如果你本地的资源已经最新，那么可以直接点击“仅 clone / pull”，后续有更新时再用增量更新即可</p>
  <p>Tips：由于是白嫖的服务所以你很可能需要挂代理不然 clone 的时候蜗牛爬</p>
  <table class="actions-table">
    <tr>
      <td class="step">1.</td>
      <td class="actions">
        <button :disabled="isProcessing" @click="handlePickDir">选择 MAA 目录</button>
        <span v-if="dirHandle">已选择目录：{{ dirHandle.name }}</span>
        <span v-else>（选择器会自动记忆上次使用的目录）</span>
      </td>
    </tr>
    <tr>
      <td class="step">2.</td>
      <td class="actions">
        <button @click="startUpdate" :disabled="!dirHandle || isProcessing">开始更新</button>
        <span class="input-group">
          <input type="radio" id="update-type-full" value="full" v-model="updateType" />
          <label for="update-type-full">全量更新</label>
        </span>
        <span class="input-group">
          <input type="radio" id="update-type-increment" value="increment" :disabled="!commitList.length" v-model="updateType" />
          <label for="update-type-increment">增量更新</label>
        </span>
        <span class="input-group" title="没事别动（">
          <input type="checkbox" id="edit-start-commit" :disabled="!commitList.length" v-model="editStartCommit" />
          <label for="edit-start-commit">更改增量起始 commit</label>
        </span>
        <select v-model="startCommit" :disabled="!commitList.length || !editStartCommit" style="font-family: monospace; width: 100%">
          <option v-for="{ message, sha1 } in commitList" :key="sha1" :value="sha1">[{{ sha1.substring(0, 7) }}] {{ message }}</option>
        </select>
      </td>
    </tr>
    <tr>
      <td class="step">进阶功能</td>
      <td class="actions">
        <button @click="gitCloneOrPullOnly" :disabled="isProcessing">仅 clone / pull</button>
        <button @click="gitClear" :disabled="isProcessing">清除 git 数据</button>
      </td>
    </tr>
  </table>
  <div v-if="gitProgress" class="progress">
    <progress :value="gitProgress.value" max="1"></progress>
    <pre>{{ gitProgress.desc }}</pre>
  </div>
  <pre v-if="errorText" class="error">{{ errorText }}</pre>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { proxy } from 'comlink';
import { useLocalStorage } from '@vueuse/core';
import { checkIsMAARoot, useDirectoryPicker } from './utils/fileSystem';
import { createGitClient } from './utils/git';
import type { GitCommit, GitProgress } from './workers/git';

const isProcessing = ref(false);
const errorText = ref('');
const gitProgress = ref<GitProgress>();
const updateType = useLocalStorage<'full' | 'increment'>('updateType', 'full');
const startCommit = useLocalStorage('startCommit', '');
const editStartCommit = ref(false);
const commitList = ref<GitCommit[]>([]);

const { dirHandle, pickDir } = useDirectoryPicker();

const handlePickDir = async () => {
  try {
    await pickDir(async handle => {
      const isMAARoot = await checkIsMAARoot(handle);
      if (isMAARoot) return true;
      return confirm('看起来这不是 MAA 的根目录，确认继续吗？');
    });
    errorText.value = '';
  } catch (error: any) {
    console.error(error);
    errorText.value = String(error);
  } finally {
    gitProgress.value = undefined;
  }
};

const gitClientPromise = createGitClient(
  'https://github.com/MaaAssistantArknights/MaaResource',
  proxy(data => {
    gitProgress.value = data;
  }),
  proxy(commits => {
    commitList.value = commits;
    if (!commits.length) updateType.value = 'full';
    if (!commits.find(c => c.sha1 === startCommit.value)) {
      startCommit.value = commits[commits.length - 1]?.sha1 || '';
    }
  }),
);

gitClientPromise.then(git => {
  (window as any).git = git;
});

const beforeProcessing = () => {
  isProcessing.value = true;
  gitProgress.value = undefined;
  errorText.value = '';
};

const handleError = (error: any) => {
  console.error(error);
  errorText.value = String(error);
};

const afterProcessing = () => {
  isProcessing.value = false;
};

const startUpdate = async () => {
  beforeProcessing();
  try {
    const git = await gitClientPromise;
    await git.update();
    const isIncrement = updateType.value === 'increment' && !!startCommit.value;
    const { total } = isIncrement
      ? await git.copyToFileSystemIncremental(dirHandle.value!, startCommit.value)
      : await git.copyToFileSystem(dirHandle.value!);
    gitProgress.value = { value: 1, desc: `Done, ${total} files updated` };
    if (isIncrement) {
      const head = await git.getHeadCommit();
      if (head) startCommit.value = head;
    }
  } catch (error) {
    handleError(error);
  } finally {
    afterProcessing();
  }
};

const gitCloneOrPullOnly = async () => {
  beforeProcessing();
  try {
    const git = await gitClientPromise;
    const type = await git.update();
    gitProgress.value = { value: 1, desc: 'Done' };
    if (type === 'clone') updateType.value = 'increment';
  } catch (error) {
    handleError(error);
  } finally {
    afterProcessing();
  }
};

const gitClear = async () => {
  const confirm = window.confirm('真的吗？');
  if (!confirm) return;
  beforeProcessing();
  try {
    const git = await gitClientPromise;
    await git.clear();
    gitProgress.value = { value: 1, desc: 'Done' };
  } catch (error) {
    handleError(error);
  } finally {
    afterProcessing();
  }
};
</script>

<style scoped lang="scss">
.actions-table {
  width: 100%;
  line-height: 28px;
  border: none;
  border-collapse: separate;
  border-spacing: 0 16px;
  user-select: none;
  td {
    padding: 0;
    vertical-align: baseline;
  }
  .step {
    text-align: right;
    white-space: nowrap;
    width: 1px;
    padding-right: 16px;
  }
}
.actions > * {
  margin-right: 8px;
}
.input-group {
  display: inline-block;
}
.progress {
  display: flex;
  flex-direction: column;
  margin-top: 16px;
  progress {
    display: block;
    width: 100%;
  }
  pre {
    margin: 8px 0 0;
  }
}
.error {
  color: red;
  margin: 16px 0 0;
}
</style>
