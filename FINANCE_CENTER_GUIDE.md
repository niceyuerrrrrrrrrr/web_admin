# 财务中心完整使用指南

## 📋 目录

1. [系统概述](#系统概述)
2. [功能模块结构](#功能模块结构)
3. [现金流管理](#现金流管理)
4. [应收应付管理](#应收应付管理)
5. [备用金管理](#备用金管理)
6. [基础数据管理](#基础数据管理)
7. [轮胎采购付款流程](#轮胎采购付款流程)
8. [业务流程图](#业务流程图)

---

## 系统概述

财务中心是一个完整的企业财务管理系统，涵盖现金流、应收应付、备用金等核心财务业务。系统采用审批流程管理，确保财务操作的规范性和可追溯性。

### 核心特性

- ✅ **双向现金流管理**：收款单和付款单独立管理
- ✅ **应收应付分离**：应收账款/回款、应付账款/实付独立模块
- ✅ **审批流程集成**：所有财务操作均需审批
- ✅ **多公司支持**：支持多公司数据隔离
- ✅ **金额精确到分**：所有金额以分为单位存储，避免精度问题
- ✅ **轮胎采购集成**：支持现付和分期两种付款模式

---

## 功能模块结构

```
财务中心
├── 现金流管理
│   ├── 收款管理
│   │   └── 收款单列表
│   └── 付款管理
│       └── 付款单列表
├── 应收应付
│   ├── 应收管理
│   │   ├── 应收账款
│   │   └── 应收回款
│   └── 应付管理
│       ├── 应付账款
│       └── 应付实付
├── 备用金管理
│   ├── 备用金发放
│   └── 备用金核销
└── 基础数据
    ├── 客户管理
    ├── 供应商管理
    └── 分类设置
```

---

## 现金流管理

### 1. 收款单列表 (`/fin/cash-in`)

**功能说明**：记录所有现金收入，包括应收回款、其他收入等。

**数据表**：`fin_cash_in`

**字段说明**：
- `amount_cents`：收款金额（分）
- `cash_date`：收款日期
- `payer_type`：**付款方**类型（customer/other）- 谁付钱给我们
- `payer_id`：**付款方**ID
- `biz_type`：业务类型（ar_receipt/other）
- `biz_id`：关联业务ID
- `method`：收款方式（bank/cash/alipay/wechat）
- `account_id`：收款账户ID
- `status`：状态（draft/reviewing/approved/rejected）

**重要说明**：收款单是记录我们收到的钱，所以`payer_type`和`payer_id`指的是**付款方**（客户付钱给我们）。

**业务流程**：
1. 财务人员创建收款单（状态：draft）
2. 提交审批（状态：reviewing）
3. 审批通过（状态：approved）
4. 如果关联应收回款，自动更新应收账款已收金额和状态

**状态说明**：
- `draft`：草稿
- `reviewing`：审批中
- `approved`：已通过
- `rejected`：已驳回

---

### 2. 付款单列表 (`/fin/cash-out`)

**功能说明**：记录所有现金支出，包括应付实付、报销、其他支出等。

**数据表**：`fin_cash_out`

**字段说明**：
- `amount_cents`：付款金额（分）
- `cash_date`：付款日期
- `payee_type`：**收款方**类型（supplier/employee/other）- 我们付钱给谁
- `payee_id`：**收款方**ID
- `biz_type`：业务类型（ap_payment/reimbursement/other）
- `biz_id`：关联业务ID
- `method`：付款方式（bank/cash/alipay/wechat）
- `account_id`：付款账户ID
- `status`：状态（draft/reviewing/approved/rejected）

**重要说明**：付款单是记录我们付出的钱，所以`payee_type`和`payee_id`指的是**收款方**（我们付钱给供应商/员工）。

**业务流程**：
1. 财务人员创建付款单（状态：draft）
2. 提交审批（状态：reviewing）
3. 审批通过（状态：approved）
4. 如果关联应付实付，自动更新应付账款已付金额和状态

**重要说明**：
- 付款单通常由审批通过后**自动生成**，不需要手动创建
- 应付实付审批通过后，自动创建对应的付款单
- 轮胎采购现付审批通过后，自动创建对应的付款单

---

## 应收应付管理

### 1. 应收账款 (`/fin/ar`)

**功能说明**：管理客户欠款，记录应收未收的款项。

**数据表**：`fin_ar`

**字段说明**：
- `code`：应收单号（自动生成，格式：AR-YYYYMMDD-XXX）
- `customer_id`：客户ID
- `ar_amount_cents`：应收金额（分）
- `received_amount_cents`：已收金额（分）
- `ar_date`：应收日期
- `due_date`：到期日期
- `status`：状态（unpaid/partial/settled/void）

**状态说明**：
- `unpaid`：未付款（已收金额 = 0）
- `partial`：部分付款（0 < 已收金额 < 应收金额）
- `settled`：已结清（已收金额 >= 应收金额）
- `void`：已作废

**业务流程**：
1. 创建应收账款（状态：unpaid）
2. 客户付款时，创建应收回款
3. 应收回款审批通过后，自动更新应收账款状态

---

### 2. 应收回款 (`/fin/ar-receipts`)

**功能说明**：记录客户的实际付款，关联到应收账款。

**数据表**：`fin_ar_receipts`

**字段说明**：
- `code`：回款单号（自动生成，格式：REC-AR-YYYYMMDDHHMMSS-XXX）
- `ar_id`：应收账款ID
- `customer_id`：客户ID
- `receipt_amount_cents`：回款金额（分）
- `receipt_date`：回款日期
- `receipt_method`：回款方式（bank/cash/alipay/wechat）
- `account_id`：收款账户ID
- `status`：状态（draft/reviewing/approved/rejected）
- `cash_in_id`：关联的收款单ID（审批通过后生成）

**业务流程**：
1. 从应收账款列表点击"回款"按钮
2. 填写回款信息（金额、日期、方式、账户）
3. 创建回款记录（状态：draft）
4. 提交审批（状态：reviewing）
5. 审批通过后：
   - 自动创建收款单（`fin_cash_in`）
   - 更新应收账款的已收金额
   - 更新应收账款状态（unpaid → partial → settled）

---

### 3. 应付账款 (`/fin/ap`)

**功能说明**：管理供应商欠款，记录应付未付的款项。

**数据表**：`fin_ap`

**字段说明**：
- `code`：应付单号（自动生成，格式：AP-YYYYMMDD-XXX）
- `supplier_id`：供应商ID
- `ap_amount_cents`：应付金额（分）
- `paid_amount_cents`：已付金额（分）
- `ap_date`：应付日期
- `due_date`：到期日期
- `status`：状态（unpaid/partial/settled/void）

**状态说明**：
- `unpaid`：未付款（已付金额 = 0）
- `partial`：部分付款（0 < 已付金额 < 应付金额）
- `settled`：已结清（已付金额 >= 应付金额）
- `void`：已作废

**业务流程**：
1. 创建应付账款（状态：unpaid）
   - 可以手动创建
   - 轮胎采购分期模式自动创建
2. 需要付款时，创建应付实付
3. 应付实付审批通过后，自动更新应付账款状态

---

### 4. 应付实付 (`/fin/ap-payments`)

**功能说明**：记录对供应商的实际付款，可以关联应付账款，也可以直接付款（如轮胎采购现付）。

**数据表**：`fin_ap_payments`

**字段说明**：
- `code`：付款单号（自动生成）
  - 从应付账款发起：`PAY-AP-YYYYMMDDHHMMSS-{ap_id}`
  - 轮胎采购现付：`PAY-TIRE-YYYYMMDDHHMMSS-{batch_id}`
- `ap_id`：应付账款ID（可为NULL）
  - 有值：从应付账款发起的付款
  - NULL：直接付款（如轮胎采购现付）
- `supplier_id`：供应商ID
- `pay_amount_cents`：付款金额（分）
- `pay_date`：付款日期
- `pay_method`：付款方式（bank/cash/alipay/wechat）
- `account_id`：付款账户ID
- `status`：状态（draft/reviewing/approved/rejected）
- `cash_out_id`：关联的付款单ID（审批通过后生成）
- `remark`：备注（轮胎采购现付会记录批次信息）

**业务流程**：

**方式一：从应付账款发起**
1. 从应付账款列表点击"付款"按钮
2. 填写付款信息（金额、日期、方式、账户）
3. 创建付款记录（状态：reviewing，自动提交审批）
4. 审批通过后：
   - 自动创建付款单（`fin_cash_out`）
   - 更新应付账款的已付金额
   - 更新应付账款状态（unpaid → partial → settled）

**方式二：轮胎采购现付**
1. 在轮胎采购列表点击"付款"按钮
2. 选择"现付"模式
3. 填写付款信息（金额、日期、方式、账户）
4. 创建付款记录（状态：reviewing，ap_id为NULL）
5. 审批通过后：
   - 自动创建付款单（`fin_cash_out`）
   - 更新轮胎采购批次的已付金额和付款状态

**重要说明**：
- 应付实付列表会显示**所有付款记录**，包括从应付账款发起的和轮胎采购现付的
- `ap_id`为NULL的记录是直接付款，不关联应付账款
- 备注字段会记录业务来源信息

---

## 备用金管理

### 1. 备用金发放 (`/fin/petty-grants`)

**功能说明**：向员工发放备用金，用于日常小额支出。

**数据表**：`fin_petty_grants`

**字段说明**：
- `code`：发放单号（自动生成）
- `employee_id`：员工ID
- `grant_amount_cents`：发放金额（分）
- `settled_amount_cents`：已核销金额（分）
- `grant_date`：发放日期
- `account_id`：发放账户ID
- `status`：状态（draft/reviewing/approved/rejected）

**业务流程**：
1. 创建备用金发放记录
2. 提交审批
3. 审批通过后，员工可使用备用金
4. 员工报销时核销备用金

---

### 2. 备用金核销 (`/fin/petty-settles`)

**功能说明**：核销员工使用的备用金，关联到报销单。

**数据表**：`fin_petty_settles`

**字段说明**：
- `code`：核销单号（自动生成）
- `grant_id`：备用金发放ID
- `employee_id`：员工ID
- `settle_amount_cents`：核销金额（分）
- `settle_date`：核销日期
- `reimbursement_id`：关联的报销单ID
- `status`：状态（draft/reviewing/approved/rejected）

**业务流程**：
1. 员工提交报销单
2. 报销单审批通过后，自动创建备用金核销记录
3. 更新备用金发放记录的已核销金额

---

## 基础数据管理

### 1. 客户管理 (`/fin/customers`)

**功能说明**：管理客户基本信息，用于应收账款和收款单。

**数据表**：`fin_customers`

**字段说明**：
- `name`：客户名称
- `contact_name`：联系人
- `contact_phone`：联系电话
- `address`：地址
- `is_active`：是否启用

---

### 2. 供应商管理 (`/fin/suppliers`)

**功能说明**：管理供应商基本信息，用于应付账款和付款单。

**数据表**：`fin_suppliers`

**字段说明**：
- `name`：供应商名称
- `contact_name`：联系人
- `contact_phone`：联系电话
- `address`：地址
- `is_active`：是否启用

**重要说明**：
- 轮胎采购时，如果供应商不存在于财务供应商表，会自动同步创建
- 供应商信息统一管理，避免重复录入

---

### 3. 分类设置 (`/fin/categories`)

**功能说明**：管理财务分类，用于报销、采购等业务的分类统计。

**数据表**：`fin_categories`

**字段说明**：
- `name`：分类名称
- `type`：分类类型（expense/income）
- `is_active`：是否启用

---

### 4. 账户列表 (`/fin/accounts`)

**功能说明**：管理公司银行账户和现金账户，用于收付款。

**数据表**：`fin_accounts`

**字段说明**：
- `name`：账户名称
- `type`：账户类型（bank/cash/alipay/wechat）
- `account_number`：账号
- `bank_name`：开户行
- `balance_cents`：账户余额（分）
- `is_active`：是否启用

---

## 轮胎采购付款流程

### 业务场景

轮胎采购支持两种付款模式：
1. **现付**：立即付款，无需创建应付账款
2. **分期**：创建应付账款，后续择机付款

---

### 现付流程

```
轮胎采购批次创建
    ↓
点击"付款"按钮 → 选择"现付"
    ↓
填写付款信息（金额、日期、方式、账户）
    ↓
创建付款单（fin_ap_payments）
  - ap_id = NULL
  - status = reviewing
  - 备注记录批次信息
    ↓
提交审批（审批类型：fin_ap_payment）
    ↓
审批通过
    ↓
自动执行：
  1. 创建现金流出记录（fin_cash_out）
  2. 更新付款单的 cash_out_id
  3. 更新轮胎采购批次的已付金额和付款状态
    ↓
完成
```

**查看位置**：
- 审批中：审批中心 > 应付实付
- 审批通过后：
  - 财务中心 > 应付实付（查看付款单）
  - 财务中心 > 付款单列表（查看现金流出记录）

---

### 分期流程

```
轮胎采购批次创建
    ↓
点击"付款"按钮 → 选择"分期"
    ↓
填写应付信息（可选到期日）
    ↓
创建应付账款（fin_ap）
  - status = unpaid
  - 备注记录批次信息
    ↓
完成（无需审批）
    ↓
后续付款时：
  从应付账款列表点击"付款"
    ↓
创建应付实付（fin_ap_payments）
  - ap_id = 应付账款ID
  - status = reviewing
    ↓
提交审批（审批类型：fin_ap_payment）
    ↓
审批通过
    ↓
自动执行：
  1. 创建现金流出记录（fin_cash_out）
  2. 更新付款单的 cash_out_id
  3. 更新应付账款的已付金额和状态
  4. 更新轮胎采购批次的已付金额和付款状态
    ↓
完成
```

**查看位置**：
- 应付账款：财务中心 > 应付账款
- 付款审批：审批中心 > 应付实付
- 付款记录：财务中心 > 应付实付
- 现金流出：财务中心 > 付款单列表

---

## 业务流程图

### 应收业务流程

```
创建应收账款
    ↓
客户付款
    ↓
创建应收回款 → 提交审批
    ↓
审批通过
    ↓
自动生成收款单 + 更新应收账款状态
```

### 应付业务流程（从应付账款）

```
创建应付账款
    ↓
需要付款
    ↓
创建应付实付 → 提交审批
    ↓
审批通过
    ↓
自动生成付款单 + 更新应付账款状态
```

### 应付业务流程（轮胎采购现付）

```
轮胎采购 → 选择现付
    ↓
创建应付实付（ap_id=NULL）→ 提交审批
    ↓
审批通过
    ↓
自动生成付款单 + 更新采购批次状态
```

---

## 数据流转关系

### 应收业务

```
fin_ar (应收账款)
    ↓ 关联
fin_ar_receipts (应收回款)
    ↓ 审批通过后生成
fin_cash_in (收款单)
```

### 应付业务

```
fin_ap (应付账款)
    ↓ 关联
fin_ap_payments (应付实付)
    ↓ 审批通过后生成
fin_cash_out (付款单)
```

### 轮胎采购现付

```
tire_purchase_batches (轮胎采购批次)
    ↓ 直接关联（通过remark）
fin_ap_payments (应付实付, ap_id=NULL)
    ↓ 审批通过后生成
fin_cash_out (付款单)
```

---

## 关键字段说明

### 金额字段

所有金额字段均以**分**为单位存储，字段名以`_cents`结尾：
- `amount_cents`：金额（分）
- `ar_amount_cents`：应收金额（分）
- `ap_amount_cents`：应付金额（分）
- `pay_amount_cents`：付款金额（分）
- `receipt_amount_cents`：回款金额（分）

**转换规则**：
- 存储：元 × 100 = 分
- 显示：分 ÷ 100 = 元

### 状态字段

**现金流状态**（`fin_cash_in`, `fin_cash_out`）：
- `draft`：草稿
- `reviewing`：审批中
- `approved`：已通过
- `rejected`：已驳回

**应收应付状态**（`fin_ar`, `fin_ap`）：
- `unpaid`：未付款
- `partial`：部分付款
- `settled`：已结清
- `void`：已作废

**付款单状态**（`fin_ap_payments`, `fin_ar_receipts`）：
- `draft`：草稿
- `reviewing`：审批中
- `approved`：已通过
- `rejected`：已驳回

### 业务类型字段

**收款单业务类型**（`fin_cash_in.biz_type`）：
- `ar_receipt`：应收回款
- `other`：其他收入

**付款单业务类型**（`fin_cash_out.biz_type`）：
- `ap_payment`：应付实付
- `reimbursement`：报销
- `other`：其他支出

---

## 审批流程说明

### 审批类型

系统中涉及财务的审批类型：
- `fin_cash_in`：收款单审批
- `fin_cash_out`：付款单审批
- `fin_ar_receipt`：应收回款审批
- `fin_ap_payment`：应付实付审批
- `fin_petty_grant`：备用金发放审批
- `fin_petty_settle`：备用金核销审批

### 审批流程配置

每个审批类型可以配置多个审批节点：
1. 节点顺序（`node_order`）
2. 节点名称（`node_name`）
3. 审批角色（`approver_role`）
4. 审批人（`approver_user_id`）

### 审批状态流转

```
draft (草稿)
    ↓ 提交审批
reviewing (审批中)
    ↓ 审批通过
approved (已通过) → 执行后续业务逻辑
    或
    ↓ 审批驳回
rejected (已驳回)
```

---

## 权限说明

### 角色权限

- **超级管理员**：所有权限，可切换公司查看数据
- **总经理**：所有财务操作权限
- **财务**：所有财务操作权限
- **其他角色**：只能查看本公司数据，部分操作需要特定权限

### 数据隔离

- 普通用户只能查看和操作本公司数据
- 超级管理员可以切换公司查看所有公司数据
- 所有财务数据都有`company_id`字段进行隔离

---

## 常见问题

### Q1: 为什么轮胎采购现付的付款单在应付实付列表中看不到应付单ID？

**A**: 现付模式不创建应付账款，所以`ap_id`为NULL。这是正常的，备注字段会记录轮胎采购批次信息。

### Q2: 付款单列表和应付实付有什么区别？

**A**: 
- **应付实付**：显示所有付款申请，包括审批中和已审批的
- **付款单列表**：只显示审批通过后生成的实际付款记录（现金流出）

### Q3: 轮胎采购现付和分期如何选择？

**A**:
- **现付**：立即付款，适合小额采购或现金交易
- **分期**：创建应付账款，适合大额采购或需要延期付款的情况

### Q4: 应付账款可以分多次付款吗？

**A**: 可以。每次付款创建一个应付实付记录，系统会自动累加已付金额，并更新应付账款状态（unpaid → partial → settled）。

### Q5: 如何查看某个轮胎采购批次的付款记录？

**A**: 
1. 在轮胎采购列表中查看已付金额和付款状态
2. 在应付实付列表中，通过备注字段搜索批次号
3. 在审批中心查看相关审批记录

---

## 技术说明

### 数据库表结构

所有财务表都以`fin_`开头：
- `fin_accounts`：账户表
- `fin_cash_in`：收款单表
- `fin_cash_out`：付款单表
- `fin_ar`：应收账款表
- `fin_ar_receipts`：应收回款表
- `fin_ap`：应付账款表
- `fin_ap_payments`：应付实付表
- `fin_customers`：客户表
- `fin_suppliers`：供应商表
- `fin_categories`：分类表
- `fin_petty_grants`：备用金发放表
- `fin_petty_settles`：备用金核销表

### API路由

- `/api/v1/fin/accounts`：账户管理
- `/api/v1/fin/cash-in`：收款单
- `/api/v1/fin/cash-out`：付款单
- `/api/v1/fin/ar`：应收账款
- `/api/v1/fin/ar-receipts`：应收回款
- `/api/v1/fin/ap`：应付账款
- `/api/v1/fin/ap-payments`：应付实付
- `/api/v1/fin/customers`：客户管理
- `/api/v1/fin/suppliers`：供应商管理
- `/api/v1/fin/categories`：分类设置
- `/api/v1/tires/payments/create`：轮胎采购付款

---

## 更新日志

### 2026-03-03
- ✅ 修复轮胎采购现付流程，支持`ap_id`为NULL
- ✅ 完善应付实付审批通过后的业务逻辑
- ✅ 优化轮胎采购批次状态更新机制
- ✅ 添加详细的调试日志

### 2026-02-09
- ✅ 创建财务中心基础表结构
- ✅ 实现现金流、应收应付、备用金等核心功能
- ✅ 集成审批流程
- ✅ 支持多公司数据隔离

---

## 联系支持

如有问题或建议，请联系系统管理员。
