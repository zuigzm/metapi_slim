import { FastifyInstance } from 'fastify';
import { detectRuntimeEnvironment, type RuntimeEnvironment } from '../../services/runtimeEnvironmentService.js';
import {
  isDockerUpdateAvailable,
  updateDockerImage,
  getDockerContainerStatus,
} from '../../services/dockerUpdateService.js';

export async function dockerUpdateRoutes(app: FastifyInstance) {
  /**
   * 获取运行环境类型
   */
  app.get('/api/docker/environment', async () => {
    const environment = await detectRuntimeEnvironment();
    const dockerAvailable = await isDockerUpdateAvailable();
    const containerStatus = await getDockerContainerStatus();

    return {
      environment,
      dockerAvailable,
      containerStatus,
    };
  });

  /**
   * 检查 Docker 更新状态
   */
  app.get('/api/docker/status', async () => {
    const environment = await detectRuntimeEnvironment();
    if (environment !== 'docker') {
      return {
        available: false,
        reason: 'Not running in Docker environment',
      };
    }

    const dockerAvailable = await isDockerUpdateAvailable();
    if (!dockerAvailable) {
      return {
        available: false,
        reason: 'Docker command not available',
      };
    }

    const containerStatus = await getDockerContainerStatus();
    return {
      available: true,
      containerStatus,
    };
  });

  /**
   * 执行 Docker 镜像更新
   */
  app.post<{ Body: { imageName: string; tag: string } }>(
    '/api/docker/update',
    async (request, reply) => {
      const environment = await detectRuntimeEnvironment();
      if (environment !== 'docker') {
        return reply.code(400).send({
          success: false,
          message: 'Not running in Docker environment',
        });
      }

      const { imageName, tag } = request.body || {};
      if (!imageName || !tag) {
        return reply.code(400).send({
          success: false,
          message: 'imageName and tag are required',
        });
      }

      try {
        const result = await updateDockerImage(imageName, tag);
        return {
          success: result.success,
          imageTag: result.imageTag,
          previousDigest: result.previousDigest,
          newDigest: result.newDigest,
          logLines: result.logLines,
        };
      } catch (error: any) {
        return reply.code(500).send({
          success: false,
          message: error?.message || 'Update failed',
        });
      }
    },
  );
}
