import type { Source } from './types.js';

const GH = 'https://raw.githubusercontent.com';

export const sources: Source[] = [
  // ACL4SSR 29 组
  { name: 'FreeSubsCheck', url: `${GH}/kooker/FreeSubsCheck/main/mihomo.yaml`, category: 'acl4ssr' },
  { name: 'yahr601', url: `${GH}/yahr601-prog/1/main/clash.yaml`, category: 'acl4ssr' },
  { name: 'Auto-Sync', url: `${GH}/walke2019/Auto-Sync/main/clash/GG/clash.yaml`, category: 'acl4ssr' },
  { name: 'ssrsub', url: `${GH}/ssrsub/ssr/master/clash.yaml`, category: 'acl4ssr' },
  { name: 'shaoyouvip', url: `${GH}/shaoyouvip/free/main/mihomo.yaml`, category: 'acl4ssr' },
  { name: 'dalazhi', url: `${GH}/dalazhi/v2ray/main/data/mihomo.yaml`, category: 'acl4ssr' },
  { name: 'getnode', url: `${GH}/limitless-d/getnode/main/clash.yaml`, category: 'acl4ssr' },

  // freeSub 24 组
  { name: 'freeSub', url: `${GH}/Ruk1ng001/freeSub/main/clash.yaml`, category: 'freesub' },

  // 其他（13 组 / 10-11 组 / 2 组 / 纯节点）
  { name: 'PuddinCat', url: `${GH}/PuddinCat/BestClash/refs/heads/main/proxies.yaml`, category: 'other' },
  { name: 'cn-news', url: `${GH}/hello-world-1989/cn-news/refs/heads/main/clash.yaml`, category: 'other' },
  { name: 'naidounode', url: `${GH}/xiaoji235/airport-free/main/clash/naidounode.txt`, category: 'other' },
  { name: 'v2rayshare', url: `${GH}/xiaoji235/airport-free/main/clash/v2rayshare.txt`, category: 'other' },
  { name: 'proxypool', url: `${GH}/snakem982/proxypool/main/source/clash-meta.yaml`, category: 'other' },
  { name: 'chromego', url: `${GH}/Misaka-blog/chromego_merge/main/sub/merged_proxies_new.yaml`, category: 'other' },
  { name: 'awesome-vpn', url: `${GH}/awesome-vpn/awesome-vpn/master/clash.yaml`, category: 'other' },
  { name: 'V2RayAggregator', url: `${GH}/mahdibland/V2RayAggregator/master/Eternity.yml`, category: 'other' },
  { name: 'ermaozi', url: `${GH}/ermaozi/get_subscribe/main/subscribe/clash.yml`, category: 'other' },
  { name: 'v2rayfree', url: `${GH}/v2raynnodes/v2rayfree/main/nodes/clashmeta.yaml`, category: 'other' },
  { name: 'yudou66', url: `${GH}/Barabama/FreeNodes/main/nodes/yudou66.yaml`, category: 'other' },
  { name: 'wenode', url: `${GH}/Barabama/FreeNodes/main/nodes/wenode.yaml`, category: 'other' },
  { name: 'dongtai-sub', url: `${GH}/wenxig/dongtai-sub/refs/heads/main/data/sub.yaml`, category: 'other' },
  { name: 'Au1rxx', url: `${GH}/Au1rxx/free-vpn-subscriptions/main/output/clash.yaml`, category: 'other' },
  { name: 'NoMoreWalls', url: `${GH}/peasoft/NoMoreWalls/master/list.meta.yml`, category: 'other' },
];
