import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DockerUpdateResult = {
  success: boolean;
  imageTag: string;
  previousDigest: string | null;
  newDigest: string | null;
  logLines: string[];
};

/**
 * 在 Docker 环境中执行镜像更新
 * 通过 docker compose 或 docker run 方式更新容器
 */
export async function updateDockerImage(
  imageName: string,
  tag: string,
): Promise<DockerUpdateResult> {
  // Mock mode for testing
  if (process.env.MOCK_RUNTIME_ENV === 'docker') {
    return {
      success: true,
      imageTag: tag,
      previousDigest: 'sha256:abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
      newDigest: 'sha256:abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd5678',
      logLines: [
        'Mock mode: Pulling new image: ' + imageName + ':' + tag,
        'Mock mode: Image pulled successfully',
        'Mock mode: Restarting container...',
        'Mock mode: Container restarted successfully',
      ],
    };
  }

  const logLines: string[][] = [];
  const fullImageName = `${imageName}:${tag}`;

  try {
    // 1. 获取当前运行的镜像 digest
    const currentDigest = await getCurrentImageDigest(imageName);

    // 2. 拉取新镜像
    logLines.push(['Pulling new image: ' + fullImageName]);
    await pullImage(fullImageName, (line) => {
      logLines.push([line]);
    });

    // 3. 获取新镜像 digest
    const newDigest = await getImageDigest(fullImageName);

    // 4. 检查是否有更新
    if (currentDigest && newDigest && currentDigest === newDigest) {
      logLines.push(['Image unchanged, no restart needed']);
      return {
        success: true,
        imageTag: tag,
        previousDigest: currentDigest,
        newDigest: newDigest,
        logLines: logLines.flat(),
      };
    }

    // 5. 重启容器
    logLines.push(['Restarting container with new image...']);
    await restartContainer(imageName, fullImageName, (line) => {
      logLines.push([line]);
    });

    return {
      success: true,
      imageTag: tag,
      previousDigest: currentDigest,
      newDigest: newDigest,
      logLines: logLines.flat(),
    };
  } catch (error) {
    logLines.push(['Error: ' + String(error)]);
    return {
      success: false,
      imageTag: tag,
      previousDigest: null,
      newDigest: null,
      logLines: logLines.flat(),
    };
  }
}

/**
 * 获取当前镜像的 digest
 */
async function getCurrentImageDigest(imageName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['inspect', '--format={{index .RepoDigests 0}}', imageName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && output.includes('@')) {
        const digest = output.trim().split('@')[1];
        resolve(digest || null);
      } else {
        resolve(null);
      }
    });

    proc.on('error', () => resolve(null));
  });
}

/**
 * 获取镜像 digest
 */
async function getImageDigest(fullImageName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['inspect', '--format={{.Digest}}', fullImageName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && output.trim()) {
        resolve(output.trim());
      } else {
        resolve(null);
      }
    });

    proc.on('error', () => resolve(null));
  });
}

/**
 * 拉取镜像
 */
async function pullImage(imageName: string, onLine?: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['pull', imageName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (data) => {
      onLine?.(data.toString().trim());
    });

    proc.stderr?.on('data', (data) => {
      onLine?.(data.toString().trim());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`docker pull failed with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * 重启容器
 */
async function restartContainer(
  containerName: string,
  newImage: string,
  onLine?: (line: string) => void,
): Promise<void> {
  // 尝试使用 docker compose 重启
  const composeResult = await tryDockerComposeRestart(containerName, newImage, onLine);
  if (composeResult) {
    return;
  }

  // 尝试直接 docker restart
  const directResult = await tryDockerRestart(containerName, newImage, onLine);
  if (directResult) {
    return;
  }

  throw new Error('Failed to restart container (tried docker compose and docker restart)');
}

/**
 * 尝试使用 docker compose 重启
 */
async function tryDockerComposeRestart(
  containerName: string,
  newImage: string,
  onLine?: (line: string) => void,
): Promise<boolean> {
  // 查找容器对应的 compose 项目
  const projectName = await getComposeProject(containerName);
  if (!projectName) {
    return false;
  }

  return new Promise((resolve) => {
    // 使用 docker compose up --force-recreate
    const proc = spawn(
      'docker',
      ['compose', '-p', projectName, 'up', '-d', '--force-recreate', '--build'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    proc.stdout?.on('data', (data) => {
      onLine?.(data.toString().trim());
    });

    proc.stderr?.on('data', (data) => {
      onLine?.(data.toString().trim());
    });

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => resolve(false));
  });
}

/**
 * 尝试直接使用 docker restart
 */
async function tryDockerRestart(
  containerName: string,
  newImage: string,
  onLine?: (line: string) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    // 先停止容器
    const stopProc = spawn('docker', ['stop', containerName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    stopProc.on('close', (stopCode) => {
      if (stopCode !== 0) {
        onLine?.('docker stop failed');
        resolve(false);
        return;
      }

      onLine?.('Container stopped, starting with new image...');

      // 然后用新镜像启动（需要知道原始的启动命令和参数）
      // 这里使用 docker run --rm -d --name {container} {newImage}
      // 注意：这可能无法完全恢复原容器的所有配置
      const startProc = spawn(
        'docker',
        ['run', '-d', '--rm', '--name', containerName, newImage],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      startProc.stdout?.on('data', (data) => {
        onLine?.(data.toString().trim());
      });

      startProc.on('close', (startCode) => {
        resolve(startCode === 0);
      });

      startProc.on('error', () => resolve(false));
    });

    stopProc.on('error', () => resolve(false));
  });
}

/**
 * 获取容器对应的 docker compose 项目名
 */
async function getComposeProject(containerName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn(
      'docker',
      ['inspect', '--format={{index .Config.Labels "com.docker.compose.project"}}', containerName],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let output = '';
    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && output.trim()) {
        resolve(output.trim());
      } else {
        resolve(null);
      }
    });

    proc.on('error', () => resolve(null));
  });
}

/**
 * 检查 Docker 更新是否可用
 */
export async function isDockerUpdateAvailable(): Promise<boolean> {
  // Mock mode for testing
  if (process.env.MOCK_RUNTIME_ENV === 'docker') {
    return true;
  }

  // 检查 docker 命令是否可用
  return new Promise((resolve) => {
    const proc = spawn('docker', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => resolve(false));
  });
}

/**
 * 获取 Docker 容器状态
 */
export async function getDockerContainerStatus(containerName?: string): Promise<{
  running: boolean;
  image: string | null;
  tag: string | null;
  digest: string | null;
} | null> {
  // Mock mode for testing
  if (process.env.MOCK_RUNTIME_ENV === 'docker') {
    return {
      running: true,
      image: '1467078763/metapi',
      tag: 'v1.3.0',
      digest: 'sha256:abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
    };
  }

  const container = containerName || 'metapi';

  return new Promise((resolve) => {
    const proc = spawn(
      'docker',
      ['inspect', '--format={{.State.Running}}|{{.Config.Image}}|{{.Image}}', container],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let output = '';
    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      const parts = output.trim().split('|');
      if (parts.length < 3) {
        resolve(null);
        return;
      }

      const [runningStr, image, imageId] = parts;
      const running = runningStr === 'true';

      // 解析镜像名和标签
      const imageParts = image.split(':');
      const tag = imageParts.length > 1 ? imageParts[1] : 'latest';

      // 从 imageId 提取 digest
      const digest = imageId.includes('@') ? imageId.split('@')[1] : null;

      resolve({
        running,
        image,
        tag,
        digest,
      });
    });

    proc.on('error', () => resolve(null));
  });
}
