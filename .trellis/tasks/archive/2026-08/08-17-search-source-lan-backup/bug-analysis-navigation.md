## Bug Analysis: 播放详情作者/专辑点击未进入搜索页

### 1. Root Cause Category

- **Category**: D - Test Coverage Gap；同时属于 B - Cross-Layer Contract。
- **Specific Cause**: `Panels` 位于 `NavigationContainer` 内、
  `Stack.Navigator` 外。它拿到的根导航对象没有 Stack 专属的 `push`
  方法；旧实现先关闭面板，再调用 `navigation.push`，因此目的路由没有
  创建。既有测试只覆盖搜索页收到参数后的状态变化，没有覆盖面板所在的
  真实导航上下文。

### 2. Why Fixes Failed

1. 初次实现用 `push + requestId` 解决相同关键词路由复用问题，但默认
   假定所有 `useNavigation` 调用点都拥有相同方法集合，属于不完整范围。
2. `runInitialMusicSearch` 纯函数测试验证了目的页行为，却无法发现来源
   面板在抵达目的页之前已经失败，属于测试层级错位。

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
| --- | --- | --- | --- |
| P0 | Architecture | `{ push: true }` 统一走 `StackActions.push + dispatch` | DONE |
| P0 | Test Coverage | 用不含 `push` 的根导航 double 覆盖面板导航 | DONE |
| P0 | Integration | Android 实测作者与专辑点击、自动填词和自动请求 | DONE |
| P1 | Documentation | 记录全局 overlay 的导航上下文合约 | DONE |

### 4. Systematic Expansion

- **Similar Issues**: 以后若 Dialog、Portal 或其他全局 overlay 新增 Stack
  专属操作，也会遇到相同方法缺失问题。
- **Design Improvement**: Stack 语义集中在 router adapter，调用组件不再
  判断自己处于 screen 还是 root overlay。
- **Process Improvement**: 跨 overlay 的导航验收必须覆盖“点击来源 -> 路由
  抵达 -> 目的页副作用”，不能只测目的页 helper。

### 5. Knowledge Capture

- [x] 更新 `frontend/type-safety.md` 的全局 overlay 导航合约。
- [x] 更新 `guides/cross-layer-thinking-guide.md` 的检查项。
- [x] 新增 `navigationActions.test.ts` 回归测试。
