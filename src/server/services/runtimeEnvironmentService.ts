import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

export type RuntimeEnvironment = 'docker' | 'k3s' | 'unknown';

const DOCKER_SOCK_PATH = '/var/run/docker.sock';

/**
 * 检测当前运行环境：Docker、K3s 或未知
 */
export async function detectRuntimeEnvironment(): Promise<RuntimeEnvironment> {
  // 检查是否在 K3s/Kubernetes 环境中
  if (isKubernetesEnvironment()) {
    return 'k3s';
  }

  // 检查 Docker socket 是否存在
  if (await hasDockerSocket()) {
    return 'docker';
  }

  // 检查模拟环境变量（用于测试）
  const mockEnv = process.env.MOCK_RUNTIME_ENV;
  if (mockEnv === 'docker' || mockEnv === 'k3s') {
    return mockEnv;
  }

  return 'unknown';
}

/**
 * 检查是否在 Kubernetes 环境中
 * 通过检测 KUBERNETES_SERVICE_HOST 或 /.kubernetes/exists 等来判断
 */
function isKubernetesEnvironment(): boolean {
  // K8s 会设置这些环境变量
  if (process.env.KUBERNETES_SERVICE_HOST) {
    return true;
  }
  if (process.env.KUBERNETES_PORT) {
    return true;
  }
  if (process.env.K8s) {
    return true;
  }

  // 检查 kubernetes.io 环境变量
  const k8sEnvVars = [
    'KUBERNETES_VERSION',
    'KUBERNETES_RELEASE_DATE',
  ];
  for (const envVar of k8sEnvVars) {
    if (process.env[envVar]) {
      return true;
    }
  }

  return false;
}

/**
 * 检查 Docker socket 是否存在
 */
async function hasDockerSocket(): Promise<boolean> {
  try {
    await access(DOCKER_SOCK_PATH, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 简化的同步检测（用于热路径）
 */
export function detectRuntimeEnvironmentSync(): RuntimeEnvironment {
  // 优先检查 K8s 环境变量
  if (
    process.env.KUBERNETES_SERVICE_HOST ||
    process.env.KUBERNETES_PORT ||
    process.env.K8s
  ) {
    return 'k3s';
  }

  // 检查 /.dockerenv 文件（Docker 容器标识）
  try {
    require('fs').accessSync('/.dockerenv', constants.R_OK);
    return 'docker';
  } catch {
    // 文件不存在，继续
  }

  // 检查 /var/run/docker.sock（需要同步检查，仅做参考）
  // 注意：同步 access 可能会有性能问题，这里不做同步检查

  return 'unknown';
}
