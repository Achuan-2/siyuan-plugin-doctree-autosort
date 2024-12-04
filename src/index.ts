import {
    Plugin,
    IModel,
} from "siyuan";
import "@/index.scss";
import { putFile, getHPathByID, getDoc, listDocTree, getFile } from "./api";

export default class DoctreeAutosort extends Plugin {

    customTab: () => IModel;

    async onload() {
        // 监听文档树右键菜单
        this.eventBus.on("open-menu-doctree", this.addSortButton.bind(this));
    }

    private async addSortButton({ detail }: any) {
        // 判断是否是自定义排序模式，不是则不添加按钮
        if (window.siyuan.config.fileTree.sort != 6) {
            return false;
        }
        const elements = detail.elements;
        if (elements.length === 1) {
            const element = elements[0];
            const isParentDoc = element.getAttribute("data-count") > 0;
            const isNotebook = element.getAttribute("data-type") === "navigation-root";
            let sortMode;



            if (isParentDoc || isNotebook) {
                if (isNotebook) {
                    sortMode = element.parentNode.getAttribute("data-sortmode");
                } else {
                    // 如果是父文档，寻找最近的ul node
                    const topElement = this.hasTopClosestByTag(element, "UL");
                    if (!topElement) {
                        return;
                    }
                    sortMode = topElement.getAttribute("data-sortmode");
                }
                if (sortMode == 6 || (window.siyuan.config.fileTree.sort === 6 && sortMode == 15)) {
                    const id = isNotebook ? element.parentNode.getAttribute("data-url") : element.getAttribute("data-node-id");
                    detail.menu.addItem({
                        icon: "iconSort",
                        label: this.i18n.sortMenuAsc,
                        click: () => this.sortDocuments(id, isNotebook, true)
                    });
                    detail.menu.addItem({
                        icon: "iconSort",
                        label: this.i18n.sortMenuDesc,
                        click: () => this.sortDocuments(id, isNotebook, false)
                    });
                }

            }
        }
    }
    private hasTopClosestByTag = (element: Node, nodeName: string) => {
        let closest = this.hasClosestByTag(element, nodeName);
        let parentClosest: boolean | HTMLElement = false;
        let findTop = false;
        while (closest && !closest.classList.contains("protyle-wysiwyg") && !findTop) {
            parentClosest = this.hasClosestByTag(closest.parentElement, nodeName);
            if (parentClosest) {
                closest = parentClosest;
            } else {
                findTop = true;
            }
        }
        return closest || false;
    };
    private hasClosestByTag = (element: Node, nodeName: string) => {
        if (!element || element.nodeType === 9) {
            return false;
        }
        if (element.nodeType === 3) {
            element = element.parentElement;
        }
        let e = element as HTMLElement;
        let isClosest = false;
        while (e && !isClosest && !e.classList.contains("b3-typography")) {
            if (e.nodeName.indexOf(nodeName) === 0) {
                isClosest = true;
            } else {
                e = e.parentElement;
            }
        }
        return isClosest && e;
    };
    private async sortDocuments(id: string, isNotebook: boolean, ascending: boolean) {

        // 保存文件的辅助函数
        let listDocTreeQuery;
        let boxID;
        if (!isNotebook) {// 子文档

            // 获取父文档信息
            const parentDocInfo = await getDoc(id);
            boxID = parentDocInfo.box;
            // 获取子文档列表
            listDocTreeQuery = {
                "notebook": boxID,
                "path": parentDocInfo.path.replace(".sy", "")
            };
        } else {// 笔记本
            boxID = id;
            listDocTreeQuery = {
                "notebook": boxID,
                "path": "/"
            };
        }
        // 获取子文档id
        const childDocIds = (await listDocTree(boxID, listDocTreeQuery.path)).tree;
        // 获取所有文档名称并排序
        const idNamePairs = await Promise.all(childDocIds.map(async (doc: any) => {
            let name = await getHPathByID(doc.id);
            // 获取name中斜杠后的最后部分
            name = name.split("/").pop();
            name = this.convertChineseNumber(name);
            console.log(name)
            return { id: doc.id, name: name };
        }));
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        idNamePairs.sort((a, b) => ascending ? collator.compare(a.name, b.name) : collator.compare(b.name, a.name));
        // 创建排序结果对象
        const sortedResult = {};
        idNamePairs.forEach((pair, index) => {
            sortedResult[pair.id] = index;
        });
        // 获取现有的sort.json文件
        const sortJson = await getFile(`/data/${boxID}/.siyuan/sort.json`);


        // 更新排序值
        for (let id in sortedResult) {
            sortJson[id] = sortedResult[id];
        }

        // 保存更新后的sort.json文件
        await putFile(`/data/${boxID}/.siyuan/sort.json`, sortJson);

        // 刷新文档树
        let element;
        if (!isNotebook) {
            element = document.querySelector(`.file-tree li[data-node-id="${id}"] > .b3-list-item__toggle--hl`);
            if (element) {
                element.click();
                element.click();
            }
        } else {
            element = document.querySelector(`.file-tree ul[data-url="${id}"] > li >.b3-list-item__toggle--hl`);
            if (element) {
                element.click();
                element.click();
            }
        }

    }





private convertChineseNumberPart(text) {
    const numMap = {
        "零": 0, "〇": 0, "两": 2, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
        "六": 6, "七": 7, "八": 8, "九": 9, "壹": 1, "贰": 2, "叁": 3, "肆": 4,
        "伍": 5, "陆": 6, "柒": 7, "捌": 8, "玖": 9, "貳": 2, "廿": 20, "卅": 30,
        "卌": 40, "圩": 50, "圆": 60, "进": 70, "枯": 80, "枠": 90
    };

    const rankMap = {
        "十": 10, "百": 100, "千": 1000, "万": 10000, "亿": 100000000,
        "拾": 10, "佰": 100, "仟": 1000, "兆": Math.pow(10, 16)
    };

    let gen = [];
    let lastRank = 1;

    if (text[0] in rankMap) {
        gen.push({ type: "number", value: 1 });
    }

    for (let c of text) {
        if (c in numMap) {
            if (numMap[c] === 0) {
                if (gen.length && gen[gen.length - 1].type === "number") {
                    gen.push({ type: "rank", value: Math.floor(lastRank / 10) });
                }
                gen.push({ type: "zero" });
            } else {
                if (gen.length && gen[gen.length - 1].type === "number") {
                    gen.push({ type: "rank", value: 10 });
                }
                gen.push({ type: "number", value: numMap[c] });
            }
        }

        if (c in rankMap) {
            lastRank = rankMap[c];
            if (gen.length && gen[gen.length - 1].type === "rank") {
                if (gen.length > 1 &&
                    gen[gen.length - 1].value === 10 &&
                    gen[gen.length - 2].type === "zero") {
                    gen[gen.length - 1].type = "number";
                    gen.push({ type: "rank", value: rankMap[c] });
                } else {
                    gen[gen.length - 1].value *= rankMap[c];
                }
                continue;
            }
            gen.push({ type: "rank", value: rankMap[c] });
        }
    }

    if (gen.length > 1) {
        if (gen[gen.length - 1].type === "number" && gen[gen.length - 2].type === "rank") {
            gen.push({ type: "rank", value: Math.floor(gen[gen.length - 2].value / 10) });
        }
    }

    if (!gen.length) return text;

    gen.reverse();
    gen.push({ type: "complete" });

    let block = [];
    let levelRank = 1;
    let currentRank = 1;

    for (let o of gen) {
        if (o.type === "number") {
            if (!block.length) block.push([]);
            block[block.length - 1].push(o.value * currentRank);
        }

        if (o.type === "rank") {
            let rank = o.value;
            if (!block.length) {
                levelRank = rank;
                currentRank = rank;
                block.push([]);
                continue;
            }

            if (rank > levelRank) {
                levelRank = rank;
                currentRank = rank;
                block[block.length - 1] = block[block.length - 1].reduce((a, b) => a + b, 0);
                block.push([]);
            } else {
                currentRank = rank * levelRank;
                block[block.length - 1] = block[block.length - 1].reduce((a, b) => a + b, 0);
                block.push([]);
            }
        }

        if (o.type === "complete" && block.length && Array.isArray(block[block.length - 1])) {
            block[block.length - 1] = block[block.length - 1].reduce((a, b) => a + b, 0);
        }
    }

    if (!block.length) return text;

    return block.reduce((a, b) => a + b, 0).toString();
}

private convertChineseNumber(s) {
    try {
        // 处理路径
        return s.replace(/[零〇两一二三四五六七八九壹贰叁肆伍陆柒捌玖貳廿卅卌圩圆进枯枠十百千万亿拾佰仟兆]+/g, match => {
            return this.convertChineseNumberPart(match);
        })

    } catch (e) {
        return s;
    }
}



}
