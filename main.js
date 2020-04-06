"use strict";

class Forest {
  constructor(forest = document.querySelector("#forest"), treeWidth = 10, treeHeight = 20, treeTemplate = "T", treeDeathTemplate = "&") {
    this.forest = forest;
    this.treeWidth = treeWidth;
    this.treeHeight = treeHeight;
    this.treeTemplate = treeTemplate;
    this.treeDeathTemplate = treeDeathTemplate;

    this.init();

    this.killRate = () => 1 / 100;
    this.newMotherRate = () => 1 / (Math.pow(this.mothersMatrix.length * 2.5, 2));
    this.motherChangeRate = () => 1 / 3;

    this.growthTime = 50;
    this.deathTime = 100;
    this.vanishTime = 400;

    this.createGrid();
    this.bind();
  }

  init() {
    this.forestMatrix = [];
    this.mothersMatrix = [];
    this.numTreesX = 0;
    this.numTreesY = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.populate = false;
    this.stopped = true;
    this.forest.innerHTML = "";
  }

  bind() {
    window.addEventListener('resize', () => this.resetGrid());

    this.forest.addEventListener('click', () => {
      this.toggleRun();
    });
  }

  toggleRun() {
    if (!this.populate && !this.stopped) return;
    this.populate = !this.populate;
    if (this.populate && this.stopped) this.populateForest();
  }

  resetGrid() {
    this.init();
    this.createGrid();
  }

  createGrid() {
    let width = this.forest.scrollWidth;
    this.numTreesX = Math.floor(width / this.treeWidth);
    this.offsetX = width % this.treeWidth;

    let height = this.forest.scrollHeight;
    this.numTreesY = Math.floor(height / this.treeHeight);
    this.offsetY = height % this.treeHeight;

    this.forest.style.padding = `${this.offsetY / 2}px ${this.offsetX / 2}px`;
    let forestHTML = '';
    for (let i = 0; i < this.numTreesY; i++) {
      forestHTML += `<div style="height: ${this.treeHeight}px" class="forest-row">`;
      for (let j = 0; j < this.numTreesX; j++) {
        forestHTML += this.createTree(i, j, false);
      }
      forestHTML += '</div>';
    }
    this.forest.innerHTML = forestHTML;
  }

  createTree(row, column, alive) {
    return `<span style="width: ${this.treeWidth}px; height: ${this.treeHeight}px; line-height: ${this.treeHeight}px;" class="tree tree-${row}-${column}">${alive ? this.treeTemplate : ''}</span>`;
  }

  async populateForest() {
    while (this.populate) {
      this.stopped = false;
      await this.growRandomTree();
      if (Math.random() < this.killRate()) {
        let target = selectRandom(this.forestMatrix);
        this.spreadDisease(target[0], target[1]); // async
        // await this.spreadDisease(target[0], target[1]); // sync
      }
    }
    this.stopped = true;
  }

  async growRandomTree() {
    let growNewMother = Math.random() < (this.mothersMatrix.length == 0 ? 1 : this.newMotherRate());

    if (growNewMother) {
      let row = Math.floor(Math.random() * this.numTreesY);
      let column = Math.floor(Math.random() * this.numTreesX);
      if (indexOfArray(this.forestMatrix, [row, column]) == -1) {
        await this.growTree(row, column);
        this.mothersMatrix.push([row, column]);
      }
    } else {
      let emptyNeighbors = [];
      let root = selectRandom(this.mothersMatrix);

      if (Math.random() < this.motherChangeRate()) {
        let neighbors = this.getAliveNeighbors(root[0], root[1]);
        if (neighbors.length > 0) {
          let index = indexOfArray(this.mothersMatrix, root);
          this.mothersMatrix[index] = selectRandom(neighbors);
        }
      }

      let tries = 0;
      do {
        tries++;
        emptyNeighbors = this.getFreeNeighbors(root[0], root[1]);
        let tempNeighbors = getNeighbors(root[0], root[1]);
        root = selectRandom(tempNeighbors);
      } while (emptyNeighbors.length == 0 && tries < 500);

      if (emptyNeighbors.length > 0) {
        let neighbor = selectRandom(emptyNeighbors);
        await this.growTree(neighbor[0], neighbor[1]);
      }
    }
  }

  getTree(row, column) {
    return this.forest.querySelector(`.tree-${row}-${column}`);
  }

  getFreeNeighbors(rootRow, rootColumn) {
    let emptyNeighbors = [];
    let neighborsMatrix = getNeighbors(rootRow, rootColumn);
    for (let n of neighborsMatrix) {
      if (this.getTree(n[0], n[1]) != null && !this.isAlive(n[0], n[1]))
        emptyNeighbors.push([n[0], n[1]]);
    }
    return emptyNeighbors;
  }

  getAliveNeighbors(rootRow, rootColumn) {
    let aliveNeighbors = [];
    let neighborsMatrix = getNeighbors(rootRow, rootColumn);
    for (let n of neighborsMatrix) {
      if (this.getTree(n[0], n[1]) != null && this.isAlive(n[0], n[1]))
        aliveNeighbors.push([n[0], n[1]]);
    }
    return aliveNeighbors;
  }

  async growTree(row, column) {
    let tree = this.getTree(row, column);
    if (tree != null) {
      tree.innerHTML = this.treeTemplate;
      tree.classList.remove('dying');
      await timeout(() => {
        tree.classList.add('grow');
      }, this.growthTime);
      this.forestMatrix.push([row, column]);
    }
  }

  async killTree(row, column) {
    let tree = this.getTree(row, column);
    tree.classList.add('dying');
    tree.innerHTML = this.treeDeathTemplate;
    await timeout(() => {
      tree.classList.remove('grow');
      timeout(() => {
        tree.classList.remove('dying');
        tree.innerHTML = '';

        let index = indexOfArray(this.forestMatrix, [row, column]);
        if (index > -1) this.forestMatrix.splice(index, 1);
        let motherIndex = indexOfArray(this.mothersMatrix, [row, column]);
        if (motherIndex > -1) this.mothersMatrix.splice(motherIndex, 1);
      }, this.vanishTime);
    }, this.deathTime);
  }

  isAlive(row, column) {
    let tree = this.getTree(row, column);
    if (tree != null) return this.forest.querySelector(`.tree-${row}-${column}`).innerHTML.length > 0;
    return false;
  }

  async spreadDisease(row, column) {
    let neighbors = [
      [row, column]
    ];
    do {
      let promisses = []
      for (let n of neighbors) {
        promisses = promisses.concat(this.spreadDiseaseSingle(n[0], n[1]));
      }
      neighbors = (await Promise.all(promisses)).reduce((r, e) => r.concat(e));
      let set = new Set(neighbors.map(JSON.stringify));
      neighbors = Array.from(set).map(JSON.parse);
    } while (neighbors.length > 0);
  }

  async spreadDiseaseSingle(row, column) {
    if (this.isAlive(row, column)) {
      await this.killTree(row, column);
      return this.getAliveNeighbors(row, column);
    }
    return [];
  }

  async spreadDiseaseRecursive(row, column) {
    if (this.isAlive(row, column)) {
      await this.killTree(row, column);
      let promises = []
      promises.push(this.spreadDisease(row - 1, column));
      promises.push(this.spreadDisease(row - 1, column + 1));
      promises.push(this.spreadDisease(row, column + 1));
      promises.push(this.spreadDisease(row + 1, column + 1));
      promises.push(this.spreadDisease(row + 1, column));
      promises.push(this.spreadDisease(row + 1, column - 1));
      promises.push(this.spreadDisease(row, column - 1));
      promises.push(this.spreadDisease(row - 1, column - 1));
      await Promise.all(promises);
    }
  }
}

function timeout(callback, time) {
  return new Promise(resolve => setTimeout(async () => {
    await callback();
    resolve();
  }, time));
}

function indexOfArray(arr, value) {
  return arr.reduce((r, v, i) => {
    if (JSON.stringify(v) == JSON.stringify(value)) return i;
    return r;
  }, -1);
}

function selectRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getNeighbors(x, y) {
  let neighbors = [];
  neighbors.push([x, y - 1]);
  neighbors.push([x + 1, y - 1]);
  neighbors.push([x + 1, y]);
  neighbors.push([x + 1, y + 1]);
  neighbors.push([x, y + 1]);
  neighbors.push([x - 1, y + 1]);
  neighbors.push([x - 1, y]);
  neighbors.push([x - 1, y - 1]);
  neighbors = neighbors.filter(e => e[0] > -1 && e[1] > -1);
  return neighbors;
}

let forest = new Forest();
forest.toggleRun();